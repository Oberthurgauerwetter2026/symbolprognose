#!/usr/bin/env python3
"""
MeteoSchweiz radar → Cloudflare R2 ingest.

Pulls the latest CPC (precipitation, mm/h) and POH (hail probability, %)
frames from the MeteoSchweiz STAC OGD catalogue, crops them to the
Oberthurgau bounding box, renders coloured PNGs (EPSG:3857 / Web Mercator),
uploads them to R2 and refreshes a manifest file `radar/frames.json`
that the Lovable app reads.

ENV (required):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_URL

ENV (optional):
  RADAR_LOOKBACK_HOURS  default 12

NOTE: This repo (symbolprognose) is the SINGLE source of truth for
radar/frames.json. The old symbolprognose-radar repo's workflow must be
disabled, otherwise it overwrites the manifest with stale data.
  RADAR_RETENTION_HOURS default 24
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

import boto3
import h5py
import numpy as np
import requests
from PIL import Image
from pyproj import Transformer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

RADAR_INGEST_VERSION = "v19-mch-intensity-boost"
STAC_BASE = "https://data.geo.admin.ch/api/stac/v1/collections"
COLLECTIONS = {
    "precip": "ch.meteoschweiz.ogd-radar-precip",  # CPC, mm/h
    "hail": "ch.meteoschweiz.ogd-radar-hail",  # POH, %
}

# Asset filename prefix per product (h5 files start with these tokens).
ASSET_PREFIX = {
    "precip": "cpc",
    "hail": "bzc",  # POH product (Probability Of Hail)
}

# Erweiterte Bbox (WGS84) — Oberthurgau + ~50 km in alle Richtungen, deckt CH-Mitte/Ost, Süd-Schwarzwald, Bodensee/Allgäu, Vorarlberg ab.
BBOX_WGS = {"minLon": 8.15, "maxLon": 10.55, "minLat": 46.85, "maxLat": 48.30}

# Output PNG resolution (Web Mercator pixels). 1024×768 hält ~1 km/px bei der grösseren Fläche.
OUT_W, OUT_H = 1024, 768

LOOKBACK = int(os.environ.get("RADAR_LOOKBACK_HOURS", "12"))
RETENTION = int(os.environ.get("RADAR_RETENTION_HOURS", "24"))

# Niederschlags-Farbskala (mm/h → RGBA), MeteoSchweiz-CombiPrecip-Reset.
# Quelle der Wahrheit für Messung-PNG UND Forecast-Canvas; identische
# Schwellen + RGBA müssen in `SCALE` in src/components/maps/radar-map.tsx
# gespiegelt sein. < 0.1 mm/h → transparent.
#
# Volle Alpha (255) ab 0.3 mm/h, damit die Bänder so kräftig wirken wie
# auf meteoschweiz.ch; die finale Deckkraft wird per Leaflet-`opacity`
# einmalig im Frontend gesetzt.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.1,   (150, 195, 235, 235)),   # sehr leicht — klar sichtbar
    (0.3,   ( 95, 155, 220, 255)),   # blau
    (0.8,   ( 40,  90, 195, 255)),   # tiefes blau
    (2.0,   ( 55, 170,  75, 255)),   # grün (SRF: bereits ab ~1–2 mm/h)
    (5.0,   (245, 220,  55, 255)),   # gelb
    (15.0,  (240, 140,  35, 255)),   # orange
    (40.0,  (220,  40,  40, 255)),   # rot
    (80.0,  (170,  40, 180, 255)),   # magenta
]

# POH (hail probability %) colour scale. 0-30 transparent.
HAIL_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (30, (255, 230, 100, 160)),
    (50, (255, 170, 60, 200)),
    (70, (255, 90, 60, 230)),
    (90, (190, 30, 180, 245)),
]

# ---------------------------------------------------------------------------
# R2 (S3-compatible) client
# ---------------------------------------------------------------------------


def env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        sys.exit(f"missing required env var: {name}")
    return val


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


BUCKET = os.environ.get("R2_BUCKET", "")
PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")


# ---------------------------------------------------------------------------
# HTTP helper with retry/backoff for transient failures
# ---------------------------------------------------------------------------


def http_get(url: str, *, timeout: int = 60, attempts: int = 4) -> requests.Response:
    """GET with exponential backoff. Retries on network errors and 5xx/429."""
    last_exc: Exception | None = None
    for i in range(attempts):
        try:
            r = requests.get(url, timeout=timeout)
            # Retry on server errors / rate limit, otherwise return immediately.
            if r.status_code >= 500 or r.status_code == 429:
                raise requests.HTTPError(f"{r.status_code} for {url}", response=r)
            return r
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if i == attempts - 1:
                break
            sleep_s = 2 ** i  # 1, 2, 4, 8
            print(f"  retry {i + 1}/{attempts - 1} after {sleep_s}s: {exc!r}", flush=True)
            time.sleep(sleep_s)
    assert last_exc is not None
    raise last_exc


# ---------------------------------------------------------------------------
# STAC discovery
# ---------------------------------------------------------------------------


@dataclass
class AssetRef:
    product: str  # "precip" | "hail"
    ts: datetime  # UTC
    href: str
    key: str  # filename


CPC_RE = re.compile(r"^([a-z]{3})(\d{2})(\d{3})(\d{2})(\d{2})")


def parse_ts_from_filename(name: str) -> datetime | None:
    """MeteoSchweiz radar filename: <prefix><YY><DOY><HH><MM><X>...

    Examples:
      cpc2614500000_00060.001.h5  -> 2026-05-25 00:00 UTC
      bzc261451245vl.845.h5       -> 2026-05-25 12:45 UTC

    Wichtig: STAC-Dateinamen sind die aktuelle, operationelle Zeitquelle.
    Sie werden als UTC behandelt. HDF5-/ODIM-Zeiten sind je nach Produkt
    Start-/Intervall-Metadaten und dürfen die STAC-Aktualität nicht bremsen.
    """
    m = CPC_RE.match(name)
    if not m:
        return None
    _, yy, doy, hh, mm = m.groups()
    try:
        year = 2000 + int(yy)
        h, mi = int(hh), int(mm)
        if not (0 <= h < 24 and 0 <= mi < 60 and 1 <= int(doy) <= 366):
            return None
        naive_utc = datetime(year, 1, 1) + timedelta(
            days=int(doy) - 1, hours=h, minutes=mi
        )
        return naive_utc.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _filename_from_asset(asset_key: str, asset: dict) -> str:
    """Best-effort filename: asset_key, href tail, title, or description."""
    candidates = [
        asset_key,
        (asset.get("href") or "").rsplit("/", 1)[-1],
        asset.get("title") or "",
        asset.get("description") or "",
    ]
    for cand in candidates:
        if cand and cand.endswith(".h5"):
            return cand
    # also scan description for an embedded .h5 token
    desc = asset.get("description") or ""
    m = re.search(r"([a-z]{3}\d{6,}[^\s/]*\.h5)", desc)
    if m:
        return m.group(1)
    return asset_key


def _extract_assets(feature: dict, product: str, prefix: str, since: datetime) -> list[AssetRef]:
    out: list[AssetRef] = []
    assets = feature.get("assets") or {}
    total = len(assets)
    matching = 0
    unparsed = 0
    too_old = 0
    no_href = 0
    for asset_key, asset in assets.items():
        fname = _filename_from_asset(asset_key, asset)
        if not fname.startswith(prefix):
            continue
        matching += 1
        ts = parse_ts_from_filename(fname)
        if ts is None:
            unparsed += 1
            continue
        if ts < since:
            too_old += 1
            continue
        href = asset.get("href")
        if not href:
            no_href += 1
            continue
        out.append(AssetRef(product=product, ts=ts, href=href, key=asset_key))
    print(f"  item: total={total} prefix='{prefix}' matched={matching} "
          f"kept={len(out)} too_old={too_old} unparsed={unparsed} no_href={no_href}",
          flush=True)
    if total and not out:
        samples = list(assets.items())[:3]
        for k, v in samples:
            print(f"    sample key={k!r} href={v.get('href','')!r}", flush=True)
    return out


def _scan_all_timestamps(feature: dict, prefix: str) -> list[datetime]:
    """Return all parseable timestamps for `prefix` assets in feature (ignores `since`)."""
    out: list[datetime] = []
    for asset_key, asset in (feature.get("assets") or {}).items():
        fname = _filename_from_asset(asset_key, asset)
        if not fname.startswith(prefix):
            continue
        ts = parse_ts_from_filename(fname)
        if ts is not None:
            out.append(ts)
    return out


def list_recent_assets(product: str, since: datetime) -> list[AssetRef]:
    """Return asset refs newer than `since`, with fallback to newest if empty.

    STAC items here are grouped per day with id `YYYYMMDD-ch`.
    """
    coll = COLLECTIONS[product]
    prefix = ASSET_PREFIX[product]
    now = datetime.now(tz=timezone.utc)
    print(f"  lookback={LOOKBACK}h since={since.isoformat()}", flush=True)
    candidates: list[AssetRef] = []
    all_assets: list[AssetRef] = []  # ignoring `since`, for fallback
    for day_offset in (0, 1):
        day = (now - timedelta(days=day_offset)).strftime("%Y%m%d")
        url = f"{STAC_BASE}/{coll}/items/{day}-ch"
        try:
            r = http_get(url, timeout=30)
            print(f"  STAC GET {day}-ch -> {r.status_code}", flush=True)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            feat = r.json()
            candidates.extend(_extract_assets(feat, product, prefix, since))
            all_assets.extend(_extract_assets(feat, product, prefix, datetime(1970, 1, 1, tzinfo=timezone.utc)))
        except Exception as exc:
            print(f"  STAC item {day}-ch error: {exc!r}", flush=True)

    if not candidates:
        try:
            url = f"{STAC_BASE}/{coll}/items?sortby=-properties.datetime&limit=3"
            r = http_get(url, timeout=30)
            print(f"  STAC fallback sort -> {r.status_code}", flush=True)
            r.raise_for_status()
            for feat in r.json().get("features", []):
                candidates.extend(_extract_assets(feat, product, prefix, since))
                all_assets.extend(_extract_assets(feat, product, prefix, datetime(1970, 1, 1, tzinfo=timezone.utc)))
        except Exception as exc:
            print(f"  STAC sort fallback error: {exc!r}", flush=True)

    if all_assets:
        ts_list = [a.ts for a in all_assets]
        print(
            f"  asset ts range: oldest={min(ts_list).isoformat()} "
            f"newest={max(ts_list).isoformat()} count={len(ts_list)}",
            flush=True,
        )
        if not candidates:
            print(
                f"  FALLBACK: {len(ts_list)} parseable {product} assets found but all older than since "
                f"({since.isoformat()}); using newest 6 available frames.",
                flush=True,
            )
            # Use newest 6 frames even though they are older than `since`,
            # so the radar map stays populated when MeteoSchweiz lags.
            candidates = sorted(all_assets, key=lambda x: x.ts)[-6:]
    else:
        print("  NOTE: no parseable assets found at all.", flush=True)

    seen: set[datetime] = set()
    uniq: list[AssetRef] = []
    for a in sorted(candidates, key=lambda x: x.ts):
        if a.ts in seen:
            continue
        seen.add(a.ts)
        uniq.append(a)
    return uniq


# ---------------------------------------------------------------------------
# H5 → cropped numpy array (Web-Mercator output grid)
# ---------------------------------------------------------------------------


def read_h5_grid(buf: bytes) -> tuple[np.ndarray, dict]:
    """Read ODIM-style MeteoSchweiz H5. Returns (values_2d, where_attrs)."""
    with h5py.File(io.BytesIO(buf), "r") as f:
        # Find the first dataset matching ODIM convention.
        ds_path = None
        for g in f.keys():
            if g.startswith("dataset"):
                d1 = f[g].get("data1") if "data1" in f[g] else None
                if d1 is not None and "data" in d1:
                    ds_path = f"/{g}/data1"
                    break
        if ds_path is None:
            raise RuntimeError("no /datasetN/data1 found")

        data_group = f[ds_path]
        dataset_group_path = "/" + ds_path.strip("/").split("/")[0]
        data = data_group["data"][:]
        what = dict(data_group["what"].attrs) if "what" in data_group else {}
        dataset_what_path = f"{dataset_group_path}/what"
        dataset_what = dict(f[dataset_what_path].attrs) if dataset_what_path in f else {}
        # Top-level /what gives nodata; /where gives projection.
        top_what = dict(f["/what"].attrs) if "/what" in f else {}
        top_where = dict(f["/where"].attrs) if "/where" in f else {}

        gain = float(what.get("gain", top_what.get("gain", 1.0)))
        offset = float(what.get("offset", top_what.get("offset", 0.0)))
        nodata = float(what.get("nodata", top_what.get("nodata", 255)))
        undetect = float(what.get("undetect", top_what.get("undetect", 0)))

        def _decode_str(v) -> str:
            if isinstance(v, (bytes, bytearray)):
                return v.decode("ascii", "ignore").strip()
            return str(v or "").strip()

        quantity = _decode_str(what.get("quantity") or top_what.get("quantity") or "")
        # Akkumulations-Intervall in Minuten aus startdate/enddate ableiten (für ACRR).
        interval_min: float | None = None
        image_time: datetime | None = None
        try:
            sd = _decode_str(what.get("startdate") or dataset_what.get("startdate") or top_what.get("startdate"))
            st = _decode_str(what.get("starttime") or dataset_what.get("starttime") or top_what.get("starttime"))
            ed = _decode_str(what.get("enddate") or dataset_what.get("enddate") or top_what.get("enddate"))
            et = _decode_str(what.get("endtime") or dataset_what.get("endtime") or top_what.get("endtime"))
            if sd and st and ed and et:
                t0 = datetime.strptime(sd + st, "%Y%m%d%H%M%S")
                t1 = datetime.strptime(ed + et, "%Y%m%d%H%M%S")
                interval_min = max(1.0, (t1 - t0).total_seconds() / 60.0)
                # ODIM-Konvention: enddate/endtime = Ende des Akkumulations-Intervalls
                # = nominaler Bildzeitpunkt. Immer UTC.
                image_time = t1.replace(tzinfo=timezone.utc)
            elif ed and et:
                image_time = datetime.strptime(ed + et, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        except Exception:
            interval_min = None
        if image_time is None:
            # Fallback auf /what date/time (nominaler Bild-Zeitpunkt in ODIM).
            try:
                dd = _decode_str(top_what.get("date") or what.get("date"))
                tt = _decode_str(top_what.get("time") or what.get("time"))
                if dd and tt:
                    image_time = datetime.strptime(dd + tt, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            except Exception:
                image_time = None

        arr = data.astype(np.float32)
        mask = (arr == nodata) | (arr == undetect) | ~np.isfinite(arr)
        arr = arr * gain + offset
        arr[mask | ~np.isfinite(arr)] = np.nan

        meta = {
            "projdef": (top_where.get("projdef") or b"").decode("ascii", "ignore")
            if isinstance(top_where.get("projdef"), (bytes, bytearray))
            else str(top_where.get("projdef", "")),
            "xscale": float(top_where.get("xscale", 1000.0)),
            "yscale": float(top_where.get("yscale", 1000.0)),
            "xsize": int(top_where.get("xsize", arr.shape[1])),
            "ysize": int(top_where.get("ysize", arr.shape[0])),
            "LL_lon": float(top_where.get("LL_lon", 0.0)),
            "LL_lat": float(top_where.get("LL_lat", 0.0)),
            "UR_lon": float(top_where.get("UR_lon", 0.0)),
            "UR_lat": float(top_where.get("UR_lat", 0.0)),
            "UL_lon": float(top_where.get("UL_lon", 0.0)),
            "UL_lat": float(top_where.get("UL_lat", 0.0)),
            "LR_lon": float(top_where.get("LR_lon", 0.0)),
            "LR_lat": float(top_where.get("LR_lat", 0.0)),
            "quantity": quantity,
            "interval_min": interval_min,
            "image_time": image_time,
        }
        return arr, meta


def sample_to_bbox(values: np.ndarray, meta: dict) -> np.ndarray:
    """
    Resample the native MeteoSchweiz grid to the WGS84 Oberthurgau bbox at
    OUT_W × OUT_H pixels using nearest-neighbour. The native grid is in a
    custom oblique stereographic projection; we use the four corner lat/lon
    from /where to set up a Transformer.
    """
    projdef = meta["projdef"] or "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs"
    # Project corners from WGS84 to native grid coords.
    to_native = Transformer.from_crs("EPSG:4326", projdef, always_xy=True)
    ll_x, ll_y = to_native.transform(meta["LL_lon"], meta["LL_lat"])
    ur_x, ur_y = to_native.transform(meta["UR_lon"], meta["UR_lat"])

    h, w = values.shape
    dx = (ur_x - ll_x) / w
    dy = (ur_y - ll_y) / h

    # Output pixel grid in WGS84 → reproject to native → index lookup.
    lons = np.linspace(BBOX_WGS["minLon"], BBOX_WGS["maxLon"], OUT_W)
    lats = np.linspace(BBOX_WGS["maxLat"], BBOX_WGS["minLat"], OUT_H)  # top→bottom
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    xs, ys = to_native.transform(lon_grid.ravel(), lat_grid.ravel())

    # Index into native array (row 0 is top in numpy; ODIM stores top→bottom).
    cols = ((xs - ll_x) / dx).astype(np.int32)
    rows = ((ur_y - ys) / dy).astype(np.int32)
    valid = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)

    out = np.full(OUT_W * OUT_H, np.nan, dtype=np.float32)
    out[valid] = values[rows[valid], cols[valid]]
    return out.reshape(OUT_H, OUT_W)


# ---------------------------------------------------------------------------
# Render PNG
# ---------------------------------------------------------------------------


def render_png(values: np.ndarray, scale: list[tuple[float, tuple[int, int, int, int]]]) -> bytes:
    h, w = values.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for thresh, color in scale:
        mask = (~np.isnan(values)) & (values >= thresh)
        rgba[mask] = color
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def head_exists(s3, key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except Exception:
        return False


def upload_png(s3, key: str, data: bytes) -> None:
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=data,
        ContentType="image/png",
        CacheControl="public, max-age=31536000, immutable",
    )


def _to_mmh(values: np.ndarray, meta: dict, product: str) -> tuple[np.ndarray, str]:
    """Konvertiert dekodierte H5-Werte je nach `what.quantity` in mm/h.

    Bekannte MeteoSchweiz/ODIM-Quantities:
      RATE        → bereits mm/h
      ACRR        → mm pro Intervall (typ. 5 min) → ×(60/intervall_min)
      DBZH / dBZ  → Marshall-Palmer Z=200·R^1.6  →  R = (10^(dBZ/10)/200)^(1/1.6)
      DBR  / dBR  → 10^(dBR/10)  (logarithmische Rate)

    Hail/POH (BZC) ist eine Wahrscheinlichkeit in % und wird unverändert
    durchgereicht — die `HAIL_SCALE` erwartet Prozent.
    """
    if product != "precip":
        return values, meta.get("quantity") or "RAW"
    q = (meta.get("quantity") or "").upper()
    arr = values
    factor_note = "x1"
    if q in ("RATE", "RR", ""):  # leer = Annahme RATE (alter Code lief so)
        out = arr
        applied = "RATE"
    elif q in ("ACRR", "ACC", "RACC"):
        interval = float(meta.get("interval_min") or 5.0)
        out = arr * (60.0 / interval)
        factor_note = f"x{60.0/interval:.2f}"
        applied = f"ACRR(interval={interval:.0f}min)"
    elif q in ("DBZH", "DBZ", "TH"):
        with np.errstate(invalid="ignore"):
            out = np.where(np.isnan(arr), np.nan, (np.power(10.0, arr / 10.0) / 200.0) ** (1.0 / 1.6))
        applied = "DBZ→MP"
    elif q in ("DBR",):
        with np.errstate(invalid="ignore"):
            out = np.where(np.isnan(arr), np.nan, np.power(10.0, arr / 10.0))
        applied = "DBR→exp"
    else:
        out = arr
        applied = f"unknown({q})→raw"
    # Negative Werte abschneiden (Artefakte aus dBZ-Konvertierung).
    out = np.where(np.isfinite(out), np.maximum(out, 0.0), np.nan)
    try:
        finite = out[np.isfinite(out)]
        if finite.size:
            mx = float(np.nanmax(finite))
            p99 = float(np.nanpercentile(finite, 99))
            warn = " ⚠OVERFLOW" if mx > 200.0 else ""
            print(
                f"  cpc quantity={q or '∅'} → {applied} {factor_note} "
                f"max={mx:.1f}mm/h p99={p99:.1f}mm/h{warn}",
                flush=True,
            )
    except Exception:
        pass
    return out, applied


def process_asset(s3, asset: AssetRef) -> str | None:
    """Download → reproject → render → upload. Returns object key or None.

    WICHTIG: Der STAC-Dateiname bleibt die primäre Zeitquelle. Die H5-Zeit
    wird nur akzeptiert, wenn sie plausibel nahe daran liegt; so verhindern
    wir sowohl Sommerzeit-Fehler als auch alte/falsch gelabelte Frames.
    """
    print(f"  fetching {asset.href}", flush=True)
    r = http_get(asset.href, timeout=60)
    r.raise_for_status()
    values, meta = read_h5_grid(r.content)
    img_ts = meta.get("image_time")
    if isinstance(img_ts, datetime):
        delta_min = abs((img_ts - asset.ts).total_seconds()) / 60.0
        if delta_min <= 10 and img_ts != asset.ts:
            print(
                f"  ts-correct: filename={asset.ts.isoformat()} → h5={img_ts.isoformat()}",
                flush=True,
            )
            asset.ts = img_ts
        elif delta_min > 10:
            print(
                f"  ts-h5 ignored: filename={asset.ts.isoformat()} h5={img_ts.isoformat()} Δ={delta_min:.0f}min",
                flush=True,
            )
    ts_iso = asset.ts.strftime("%Y%m%dT%H%M")
    key = f"radar/{asset.product}/{ts_iso}.png"
    if head_exists(s3, key):
        return key
    converted, _applied = _to_mmh(values, meta, asset.product)
    cropped = sample_to_bbox(converted, meta)
    scale = PRECIP_SCALE if asset.product == "precip" else HAIL_SCALE
    png = render_png(cropped, scale)
    upload_png(s3, key, png)
    print(f"  uploaded {key} ({len(png)} bytes)", flush=True)
    return key


def cleanup(s3, keep_since: datetime) -> None:
    """Delete radar/*.png objects older than `keep_since`."""
    paginator = s3.get_paginator("list_objects_v2")
    deleted = 0
    for product in COLLECTIONS:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f"radar/{product}/"):
            for obj in page.get("Contents", []) or []:
                k = obj["Key"]
                # key tail = YYYYMMDDTHHMM.png
                tail = k.rsplit("/", 1)[-1].removesuffix(".png")
                try:
                    ts = datetime.strptime(tail, "%Y%m%dT%H%M").replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                if ts < keep_since:
                    s3.delete_object(Bucket=BUCKET, Key=k)
                    deleted += 1
    if deleted:
        print(f"cleanup: deleted {deleted} old frames", flush=True)


def purge_all_radar_pngs(s3) -> int:
    """Delete all generated radar PNGs so a version rebuild cannot mix frames."""
    paginator = s3.get_paginator("list_objects_v2")
    purged = 0
    for product in COLLECTIONS:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f"radar/{product}/"):
            for obj in page.get("Contents", []) or []:
                s3.delete_object(Bucket=BUCKET, Key=obj["Key"])
                purged += 1
    return purged


def write_manifest(s3) -> None:
    """List all current radar/*.png keys and build frames.json."""
    paginator = s3.get_paginator("list_objects_v2")
    frames: dict[str, dict] = {}  # ts_iso → {ts, precipUrl?, hailUrl?}
    for product in COLLECTIONS:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f"radar/{product}/"):
            for obj in page.get("Contents", []) or []:
                k = obj["Key"]
                tail = k.rsplit("/", 1)[-1].removesuffix(".png")
                try:
                    ts = datetime.strptime(tail, "%Y%m%dT%H%M").replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                iso = ts.strftime("%Y-%m-%dT%H:%M:00Z")
                entry = frames.setdefault(iso, {"t": iso})
                url = f"{PUBLIC_URL}/{k}"
                if product == "precip":
                    entry["precipUrl"] = url
                else:
                    entry["hailUrl"] = url
    sorted_frames = sorted(frames.values(), key=lambda x: x["t"])
    body: dict = {
        "bbox": BBOX_WGS,
        "generatedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": RADAR_INGEST_VERSION,
        "frames": sorted_frames,
    }
    if not sorted_frames:
        body["warning"] = "current ingest produced no usable radar PNG frames"
    s3.put_object(
        Bucket=BUCKET,
        Key="radar/frames.json",
        Body=json.dumps(body).encode("utf-8"),
        ContentType="application/json",
        CacheControl="public, max-age=30",
    )
    print(f"manifest: {len(sorted_frames)} frames", flush=True)


def main() -> int:
    github_sha = os.environ.get("GITHUB_SHA", "local")
    github_ref = os.environ.get("GITHUB_REF", "local")
    print(
        f"RADAR INGEST START version={RADAR_INGEST_VERSION} lookback={LOOKBACK}h "
        f"retention={RETENTION}h sha={github_sha} ref={github_ref}",
        flush=True,
    )
    if not BUCKET or not PUBLIC_URL:
        sys.exit("R2_BUCKET and R2_PUBLIC_URL must be set")
    s3 = make_s3()
    now = datetime.now(tz=timezone.utc)
    since = now - timedelta(hours=LOOKBACK)

    # Versions-Migration: wenn das bestehende Manifest eine alte INGEST-Version
    # hat, sind alle bisherigen PNGs möglicherweise unter falsch abgeleiteten
    # Dateinamens-Zeitstempeln gespeichert. Einmaliges Purge, damit der neue
    # Run direkt mit sauberen, aus H5-Metadaten abgeleiteten Zeiten startet.
    try:
        existing = s3.get_object(Bucket=BUCKET, Key="radar/frames.json")
        existing_body = json.loads(existing["Body"].read().decode("utf-8"))
        existing_version = existing_body.get("version")
        if existing_version != RADAR_INGEST_VERSION:
            print(
                f"version migration: {existing_version!r} → {RADAR_INGEST_VERSION!r}; "
                f"purging old radar/*.png objects",
                flush=True,
            )
            purged = purge_all_radar_pngs(s3)
            print(f"  purged {purged} old radar PNG objects", flush=True)
    except Exception as exc:
        print(f"version migration: no existing manifest or purge failed ({exc!r})", flush=True)


    processed = 0
    skipped_existing = 0
    failed: dict[str, list[str]] = {p: [] for p in COLLECTIONS}
    candidates: dict[str, int] = {p: 0 for p in COLLECTIONS}
    precip_assets_all: list[AssetRef] = []
    for product in COLLECTIONS:
        print(f"== {product} (since {since.isoformat()}) ==", flush=True)
        try:
            assets = list_recent_assets(product, since)
        except Exception as exc:
            print(f"  STAC error: {exc}", flush=True)
            continue
        candidates[product] = len(assets)
        print(f"  {len(assets)} candidate frames", flush=True)
        if product == "precip":
            precip_assets_all = list(assets)
        for a in assets:
            # Per-Asset Retry: ein Fehler bei einem einzelnen Frame darf
            # weder den Rest des Produkts noch das andere Produkt abbrechen.
            ok = False
            last_exc: Exception | None = None
            for attempt in range(2):
                try:
                    if process_asset(s3, a):
                        ok = True
                        processed += 1
                    break
                except Exception as exc:
                    last_exc = exc
                    print(
                        f"  ! attempt {attempt + 1}/2 failed for {a.key}: {exc!r}",
                        flush=True,
                    )
                    time.sleep(1.5 * (attempt + 1))
            if not ok:
                failed[product].append(a.ts.strftime("%Y%m%dT%H%M"))
                print(f"  X giving up on {a.key}: {last_exc!r}", flush=True)

    print(
        f"summary: processed={processed} skipped_existing={skipped_existing} "
        f"failed_precip={len(failed['precip'])} failed_hail={len(failed['hail'])}",
        flush=True,
    )
    for product, tags in failed.items():
        if tags:
            print(f"  failed {product}: {', '.join(tags[:20])}{' ...' if len(tags) > 20 else ''}", flush=True)

    # Bucket-Inventur + Lückenstatistik, damit klar ist was wirklich in R2 liegt.
    try:
        paginator = s3.get_paginator("list_objects_v2")
        inventory: dict[str, set[str]] = {p: set() for p in COLLECTIONS}
        for product in COLLECTIONS:
            for page in paginator.paginate(Bucket=BUCKET, Prefix=f"radar/{product}/"):
                for obj in page.get("Contents", []) or []:
                    tail = obj["Key"].rsplit("/", 1)[-1].removesuffix(".png")
                    inventory[product].add(tail)
            print(
                f"  R2 inventory radar/{product}/: {len(inventory[product])} objects",
                flush=True,
            )
        # Asymmetrie precip vs hail (Frames mit nur einem Produkt → halb-leere Animation)
        only_precip = inventory["precip"] - inventory["hail"]
        only_hail = inventory["hail"] - inventory["precip"]
        print(
            f"  asymmetry: only_precip={len(only_precip)} only_hail={len(only_hail)}",
            flush=True,
        )
    except Exception as exc:
        print(f"  R2 inventory error: {exc!r}", flush=True)

    cleanup(s3, now - timedelta(hours=RETENTION))
    write_manifest(s3)
    print(f"done: processed {processed} new frames", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
