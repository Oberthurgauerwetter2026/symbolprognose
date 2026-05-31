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
from zoneinfo import ZoneInfo

# MeteoSchweiz CPC/POH STAC-Dateinamen sind in Europe/Zurich Lokalzeit
# (DST-aware) angegeben, nicht in UTC. Ohne diese Umrechnung ergibt sich
# im Sommer ein 1-h-Versatz gegenüber der MCH-Niederschlagskarte.
MCH_FILENAME_TZ = ZoneInfo("Europe/Zurich")

import boto3
import h5py
import numpy as np
import requests
from PIL import Image
from pyproj import Transformer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

RADAR_INGEST_VERSION = "v12-h5-metadata-time"
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

# Niederschlags-Farbskala (mm/h → RGBA). Identisch zur Prognose-Palette
# (`SCALE` / `colorFor` in src/components/maps/radar-map.tsx), damit Messung
# und Prognose bei gleichen mm/h-Werten gleich aussehen. < 0.2 mm/h = transparent.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.2, (167, 174, 211, 89)),    # a≈0.35
    (1.0, (30, 60, 230, 153)),     # a≈0.60
    (2.0, (30, 120, 50, 153)),
    (4.0, (70, 200, 70, 153)),
    (6.0, (240, 235, 50, 153)),
    (10.0, (240, 200, 120, 153)),
    (20.0, (240, 140, 30, 153)),
    (40.0, (225, 30, 30, 153)),
    (60.0, (150, 30, 200, 153)),
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
        naive_local = datetime(year, 1, 1) + timedelta(
            days=int(doy) - 1, hours=h, minutes=mi
        )
        return naive_local.replace(tzinfo=MCH_FILENAME_TZ).astimezone(timezone.utc)
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

        data = f[ds_path]["data"][:]
        what = dict(f[ds_path]["what"].attrs) if "what" in f[ds_path] else {}
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
            sd = _decode_str(what.get("startdate") or top_what.get("startdate"))
            st = _decode_str(what.get("starttime") or top_what.get("starttime"))
            ed = _decode_str(what.get("enddate") or top_what.get("enddate"))
            et = _decode_str(what.get("endtime") or top_what.get("endtime"))
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
        mask = (arr == nodata) | (arr == undetect)
        arr = arr * gain + offset
        arr[mask] = np.nan

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

    WICHTIG: Der Bildzeitpunkt wird NICHT aus dem Dateinamen abgeleitet
    (MCH-Filename-Schema ist nicht zuverlässig), sondern aus den H5-Metadaten
    (`/dataset*/what` enddate/endtime bzw. `/what` date/time). Erst danach
    wird der R2-Key gebildet. `asset.ts` (aus dem Filename) dient nur als
    grobe Lookback-Heuristik beim STAC-Filtern.
    """
    print(f"  fetching {asset.href}", flush=True)
    r = http_get(asset.href, timeout=60)
    r.raise_for_status()
    values, meta = read_h5_grid(r.content)
    img_ts = meta.get("image_time")
    if isinstance(img_ts, datetime):
        if img_ts != asset.ts:
            print(
                f"  ts-correct: filename={asset.ts.isoformat()} → h5={img_ts.isoformat()}",
                flush=True,
            )
        asset.ts = img_ts  # update so motion + manifest use the real time
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


def _phase_correlation(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """FFT phase correlation. Returns (dx_px, dy_px, confidence) for motion
    from a (older) to b (newer).

    Convention:
      • dx_px > 0  → feature moved to the right (col+) between a and b → eastward.
      • dy_px > 0  → feature moved downward (row+) → southward.

    Math: if b(x) = a(x − d) (b is a shifted by +d), the Fourier shift
    theorem gives B = A · exp(−i·2π·k·d/N). Hence
        conj(A) · B  =  |A|² · exp(−i·2π·k·d/N)
    whose inverse FFT has its peak at +d. Using A · conj(B) instead would
    place the peak at −d, which is the original bug that made nowcast
    cells drift backwards. We therefore use conj(A) · B.
    """
    a = np.nan_to_num(a, nan=0.0).astype(np.float32)
    b = np.nan_to_num(b, nan=0.0).astype(np.float32)
    a = a - a.mean()
    b = b - b.mean()
    h, w = a.shape
    win = np.hanning(h)[:, None] * np.hanning(w)[None, :]
    A = np.fft.fft2(a * win)
    B = np.fft.fft2(b * win)
    R = np.conj(A) * B
    R /= np.abs(R) + 1e-10
    c = np.fft.ifft2(R).real
    peak = np.unravel_index(int(np.argmax(c)), c.shape)
    py, px = int(peak[0]), int(peak[1])
    if py > h // 2:
        py -= h
    if px > w // 2:
        px -= w
    dx_px = float(px)
    dy_px = float(py)
    peak_v = float(c.max())
    mean_v = float(c.mean())
    std_v = float(c.std()) + 1e-10
    snr = (peak_v - mean_v) / std_v
    conf = float(max(0.0, min(1.0, snr / 60.0)))
    return dx_px, dy_px, conf


# --- Optical-Flow: tile-based phase correlation ---------------------------
# Liefert ein Bewegungsfeld statt eines einzelnen globalen Vektors. Pro
# Kachel wird die Phasenkorrelation eigenständig ausgewertet; Kacheln ohne
# Niederschlag oder mit zu niedriger SNR werden verworfen.

TILE_PX = 128
TILE_STRIDE = 64
TILE_MIN_WET = 0.05      # Anteil "nasser" Pixel in der Kachel
TILE_MIN_CONF = 0.15
TILE_MAX_SHIFT_PX = 32   # plausibler Maximum-Shift pro Frame-Paar


def _phase_correlation_tiles(
    a: np.ndarray, b: np.ndarray
) -> list[tuple[int, int, float, float, float, float]]:
    """Returns list of (cx_px, cy_px, dx_px, dy_px, conf, wet_frac) per tile.

    cx/cy = Kachelmittelpunkt in Bildpixeln (Web-Mercator-Raster OUT_W×OUT_H).
    dx_px > 0 → Ost-Bewegung, dy_px > 0 → Süd-Bewegung (Y-Achse nach unten).
    """
    a = np.nan_to_num(a, nan=0.0).astype(np.float32)
    b = np.nan_to_num(b, nan=0.0).astype(np.float32)
    h, w = a.shape
    if h < TILE_PX or w < TILE_PX:
        return []
    win = np.hanning(TILE_PX)[:, None] * np.hanning(TILE_PX)[None, :]
    out: list[tuple[int, int, float, float, float, float]] = []
    for y in range(0, h - TILE_PX + 1, TILE_STRIDE):
        for x in range(0, w - TILE_PX + 1, TILE_STRIDE):
            ta = a[y : y + TILE_PX, x : x + TILE_PX]
            tb = b[y : y + TILE_PX, x : x + TILE_PX]
            cx = x + TILE_PX // 2
            cy = y + TILE_PX // 2
            wet = float(np.mean((ta > 0.1) | (tb > 0.1)))
            if wet < TILE_MIN_WET:
                out.append((cx, cy, 0.0, 0.0, 0.0, wet))
                continue
            ta_d = ta - ta.mean()
            tb_d = tb - tb.mean()
            A = np.fft.fft2(ta_d * win)
            B = np.fft.fft2(tb_d * win)
            R = np.conj(A) * B
            R /= np.abs(R) + 1e-10
            c = np.fft.ifft2(R).real
            peak = np.unravel_index(int(np.argmax(c)), c.shape)
            py, px_ = int(peak[0]), int(peak[1])
            if py > TILE_PX // 2:
                py -= TILE_PX
            if px_ > TILE_PX // 2:
                px_ -= TILE_PX
            if abs(px_) > TILE_MAX_SHIFT_PX or abs(py) > TILE_MAX_SHIFT_PX:
                out.append((cx, cy, 0.0, 0.0, 0.0, wet))
                continue
            peak_v = float(c.max())
            mean_v = float(c.mean())
            std_v = float(c.std()) + 1e-10
            snr = (peak_v - mean_v) / std_v
            conf = float(max(0.0, min(1.0, snr / 60.0)))
            out.append((cx, cy, float(px_), float(py), conf, wet))
    return out


def _load_wind_prior(now: datetime) -> tuple[float, float] | None:
    """700-hPa-Wind aus openmeteo/forecast.json (R2-Cache), in m/s als (u, v).

    Konvention: u > 0 → Strömung nach Osten, v > 0 → Strömung nach Norden.
    Wird im Tile-Feld als Prior eingemischt — datenarme Kacheln driften so
    Richtung Wind, statt 0 zu bleiben.
    """
    if not BUCKET:
        return None
    try:
        s3 = make_s3()
        obj = s3.get_object(Bucket=BUCKET, Key="openmeteo/forecast.json")
        payload = json.loads(obj["Body"].read().decode("utf-8"))
    except Exception as exc:
        print(f"wind-prior: cache fetch failed: {exc!r}", flush=True)
        return None
    grid = payload.get("grid", {}).get("points") or []
    locs = payload.get("locations") or payload.get("forecasts") or []
    if not grid or not locs:
        return None
    mid_lat = (BBOX_WGS["minLat"] + BBOX_WGS["maxLat"]) / 2
    mid_lon = (BBOX_WGS["minLon"] + BBOX_WGS["maxLon"]) / 2
    best_i = -1
    best_d = float("inf")
    for i, p in enumerate(grid):
        try:
            d = (p["lat"] - mid_lat) ** 2 + (p["lon"] - mid_lon) ** 2
        except Exception:
            continue
        if d < best_d:
            best_d = d
            best_i = i
    if best_i < 0 or best_i >= len(locs):
        return None
    hourly = (locs[best_i] or {}).get("hourly") or {}
    times = hourly.get("time") or []
    sp = hourly.get("wind_speed_700hPa") or []
    di = hourly.get("wind_direction_700hPa") or []
    if not times or not sp or not di:
        return None
    target_ms = now.timestamp() * 1000.0
    hi = -1
    for i, t in enumerate(times):
        try:
            tms = datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp() * 1000.0
        except Exception:
            continue
        if tms <= target_ms:
            hi = i
        else:
            break
    if hi < 0:
        return None
    try:
        speed_kmh = float(sp[hi])
        direction = float(di[hi])  # meteorologisch: woher der Wind kommt
    except Exception:
        return None
    speed_ms = speed_kmh * 1000.0 / 3600.0
    rad = np.radians(direction)
    # Wind weht von dir → Strömung in Gegenrichtung. u/v positiv = Ost/Nord.
    u_ms = -speed_ms * float(np.sin(rad))
    v_ms = -speed_ms * float(np.cos(rad))  # +Nord; SVG-Y invertiert wird im Feld behandelt
    # Pixel-Konvention: dx_px > 0 → Ost, dy_px > 0 → Süd. Daher Y-Achse flippen.
    return u_ms, -v_ms  # zweiter Wert ist „v in Pixel-Y-Richtung" = nach Süden positiv



def compute_motion(precip_assets: list[AssetRef]) -> dict | None:
    """Mean precipitation-cell motion + growth/decay trend.

    Erweitert ggü. v7-Original:
      • nutzt die letzten **6 Frames** (5 Paare) statt 3 → Median stabiler,
        Null-Drift-Fehlalarme seltener.
      • berechnet zusätzlich `growth_per_min`: lineare Steigung der mittleren
        Intensität pro Minute, normiert auf den Mittelwert, in %/min.
        > 0 = Zellen wachsen, < 0 = zerfallen. Frontend dimmt Nowcast-PNGs
        entsprechend (analog MeteoSchweiz INCA-Exponential-Decay).
    """
    last = sorted(precip_assets, key=lambda a: a.ts)[-6:]
    if len(last) < 2:
        print("motion: <2 recent precip frames, skipping", flush=True)
        return None
    arrs: list[tuple[datetime, np.ndarray]] = []
    for a in last:
        try:
            r = http_get(a.href, timeout=60)
            r.raise_for_status()
            values, meta = read_h5_grid(r.content)
            cropped = sample_to_bbox(values, meta)
            arrs.append((a.ts, cropped))
        except Exception as exc:
            print(f"motion: decode {a.key} failed: {exc!r}", flush=True)
    if len(arrs) < 2:
        print("motion: <2 decoded frames, skipping", flush=True)
        return None

    pair_motions: list[tuple[float, float, float]] = []
    # Per-tile motion über alle Paare. Layout entspricht
    # _phase_correlation_tiles() → stabile Reihenfolge zwischen Paaren.
    pair_tiles: list[list[tuple[int, int, float, float, float, float]]] = []
    for i in range(len(arrs) - 1):
        t_old, a_old = arrs[i]
        t_new, a_new = arrs[i + 1]
        dt_min = max(1.0, (t_new - t_old).total_seconds() / 60.0)
        if np.nansum(a_old > 0.1) < 50 or np.nansum(a_new > 0.1) < 50:
            print(f"motion: pair {t_old}→{t_new} too sparse, skip", flush=True)
            continue
        dx_px, dy_px, conf = _phase_correlation(a_old, a_new)
        if abs(dx_px) > 60 or abs(dy_px) > 60:
            print(f"motion: pair {t_old}→{t_new} jump too large, skip", flush=True)
            continue
        if abs(dx_px) < 0.5 and abs(dy_px) < 0.5:
            print(
                f"motion: pair {t_old.strftime('%H:%M')}→{t_new.strftime('%H:%M')} "
                f"zero shift dx={dx_px:+.2f}px dy={dy_px:+.2f}px → discard",
                flush=True,
            )
            continue
        pair_motions.append((dx_px / dt_min, dy_px / dt_min, conf))
        try:
            tiles = _phase_correlation_tiles(a_old, a_new)
            # In px/min normalisieren, damit Aggregation über Paare mit
            # ungleichen Zeitabständen sauber bleibt.
            normalised = [
                (cx, cy, dx / dt_min, dy / dt_min, c, wet)
                for (cx, cy, dx, dy, c, wet) in tiles
            ]
            pair_tiles.append(normalised)
        except Exception as exc:
            print(f"motion: tile pair {t_old}→{t_new} error {exc!r}", flush=True)
        print(
            f"motion: pair {t_old.strftime('%H:%M')}→{t_new.strftime('%H:%M')} "
            f"dx={dx_px:+.1f}px dy={dy_px:+.1f}px conf={conf:.2f} dt={dt_min:.0f}min",
            flush=True,
        )


    if not pair_motions:
        print("motion: no usable pairs → discarded", flush=True)
        return None

    u_px_min = float(np.median([p[0] for p in pair_motions]))
    v_px_min = float(np.median([p[1] for p in pair_motions]))
    conf_med = float(np.median([p[2] for p in pair_motions]))

    if abs(u_px_min) < 0.5 and abs(v_px_min) < 0.5:
        print(
            f"motion: median zero shift u={u_px_min:+.2f}px/min v={v_px_min:+.2f}px/min → discarded",
            flush=True,
        )
        return None

    deg_lon_per_px = (BBOX_WGS["maxLon"] - BBOX_WGS["minLon"]) / OUT_W
    deg_lat_per_px = (BBOX_WGS["maxLat"] - BBOX_WGS["minLat"]) / OUT_H
    u_deg_min = u_px_min * deg_lon_per_px
    v_deg_min = -v_px_min * deg_lat_per_px

    mid_lat = (BBOX_WGS["maxLat"] + BBOX_WGS["minLat"]) / 2
    m_per_deg_lat = 111_000.0
    m_per_deg_lon = 111_000.0 * float(np.cos(np.radians(mid_lat)))
    u_ms = u_deg_min * m_per_deg_lon / 60.0
    v_ms = v_deg_min * m_per_deg_lat / 60.0

    # --- Growth/Decay-Trend ---
    # Lineare Regression von mean(precip > 0.1) gegen Minuten. growth_per_min
    # ist die relative Steigung (1/min). Wird in Frontend als Nowcast-Decay
    # angewendet: opacity_minutes_ahead = clamp(1 + growth_per_min*m, 0.25, 1.6).
    growth_per_min: float | None = None
    try:
        ts0 = arrs[0][0]
        ts_min = np.array(
            [(t - ts0).total_seconds() / 60.0 for t, _ in arrs], dtype=np.float64
        )
        means = np.array(
            [float(np.nanmean(np.where(a > 0.05, a, 0.0))) for _, a in arrs],
            dtype=np.float64,
        )
        # nur falls genug Signal
        base = float(np.nanmean(means)) if means.size else 0.0
        if base > 0.02 and len(arrs) >= 3:
            slope = float(np.polyfit(ts_min, means, 1)[0])  # mm/h per min
            growth_per_min = slope / base
            # auf vernünftiges Band klemmen (±5 %/min)
            growth_per_min = float(max(-0.05, min(0.05, growth_per_min)))
            print(
                f"motion: growth trend base={base:.3f} slope={slope:+.4f} "
                f"→ {growth_per_min*100:+.2f}%/min",
                flush=True,
            )
    except Exception as exc:
        print(f"motion: growth trend error {exc!r}", flush=True)
        growth_per_min = None

    # Mittlere Radar-Intensität der letzten 3 Frames (mm/h, nur "echte" Niederschlagsfläche).
    # Wird vom Frontend als Bias-Anker für ICON-CH1 in den ersten +2 h genutzt.
    recent_mean_mmh: float | None = None
    recent_wet_frac: float | None = None
    try:
        tail = arrs[-3:] if len(arrs) >= 3 else arrs
        wet_vals = []
        wet_counts = []
        total_counts = []
        for _, a in tail:
            mask = ~np.isnan(a) & (a > 0.1)
            total_counts.append(int(np.size(a)))
            wet_counts.append(int(mask.sum()))
            if mask.any():
                wet_vals.append(float(np.nanmean(a[mask])))
        if wet_vals:
            recent_mean_mmh = float(np.mean(wet_vals))
        if total_counts:
            recent_wet_frac = float(np.sum(wet_counts) / max(1, np.sum(total_counts)))
    except Exception as exc:
        print(f"motion: bias-anchor error {exc!r}", flush=True)

    motion: dict = {
        "u_ms": round(u_ms, 3),
        "v_ms": round(v_ms, 3),
        "u_deg_per_min": round(u_deg_min, 6),
        "v_deg_per_min": round(v_deg_min, 6),
        "sourceTs": arrs[-1][0].strftime("%Y-%m-%dT%H:%M:00Z"),
        "confidence": round(conf_med, 3),
        "pairs": len(pair_motions),
        "frames": len(arrs),
    }
    if recent_mean_mmh is not None:
        motion["recent_mean_mmh"] = round(recent_mean_mmh, 3)
    if recent_wet_frac is not None:
        motion["recent_wet_frac"] = round(recent_wet_frac, 4)
    if growth_per_min is not None:
        motion["growth_per_min"] = round(growth_per_min, 5)

    # --- Motion-Field (tile-basierte Optical-Flow-Aggregation) ---
    # Aggregiert die Per-Pair-Kachelvektoren (px/min) zu einem stabilen Feld
    # und mischt 700-hPa-Wind als Prior für datenarme Kacheln ein. Frontend
    # nutzt das Feld als gewichteten Median statt eines globalen Vektors.
    try:
        field = _aggregate_motion_field(
            pair_tiles,
            arrs,
            wind_prior=_load_wind_prior(arrs[-1][0]),
        )
        if field is not None:
            motion["field"] = field
            print(
                f"motion: field rows={field['rows']} cols={field['cols']} "
                f"active_tiles={field.get('active_tiles')} "
                f"wind_prior={'yes' if field.get('wind_prior_used') else 'no'}",
                flush=True,
            )
    except Exception as exc:
        print(f"motion: field error {exc!r}", flush=True)

    print(f"motion: {motion}", flush=True)
    return motion


def _aggregate_motion_field(
    pair_tiles: list[list[tuple[int, int, float, float, float, float]]],
    arrs: list[tuple[datetime, np.ndarray]],
    wind_prior: tuple[float, float] | None = None,
) -> dict | None:
    """Aggregiert Per-Pair-Kachelvektoren zu einem Bewegungsfeld.

    Output (alle Arrays row-major über rows×cols, flach):
      rows, cols, cx_px[], cy_px[],
      u_deg_per_min[], v_deg_per_min[], conf[], wet[], growth_per_min[]
    """
    if not pair_tiles:
        return None
    # Anzahl Kacheln muss zwischen Paaren konsistent sein.
    n_tiles = len(pair_tiles[0])
    if not all(len(p) == n_tiles for p in pair_tiles) or n_tiles == 0:
        return None
    # Anker (cx, cy) aus erstem Paar; identisch in allen.
    cxs = [t[0] for t in pair_tiles[0]]
    cys = [t[1] for t in pair_tiles[0]]
    unique_cy = sorted(set(cys))
    unique_cx = sorted(set(cxs))
    rows = len(unique_cy)
    cols = len(unique_cx)
    if rows * cols != n_tiles:
        return None

    deg_lon_per_px = (BBOX_WGS["maxLon"] - BBOX_WGS["minLon"]) / OUT_W
    deg_lat_per_px = (BBOX_WGS["maxLat"] - BBOX_WGS["minLat"]) / OUT_H
    mid_lat = (BBOX_WGS["maxLat"] + BBOX_WGS["minLat"]) / 2
    m_per_deg_lat = 111_000.0
    m_per_deg_lon = 111_000.0 * float(np.cos(np.radians(mid_lat)))

    # Wind-Prior in px/min (dx_px > 0 → Ost, dy_px > 0 → Süd).
    wind_dx_pm = None
    wind_dy_pm = None
    if wind_prior is not None:
        u_ms_w, v_pixY_ms_w = wind_prior  # v_pixY_ms_w bereits Y-Pixel-Richtung (südwärts +)
        # m/s → deg/min → px/min
        u_deg_min_w = u_ms_w * 60.0 / m_per_deg_lon
        v_deg_min_w = v_pixY_ms_w * 60.0 / m_per_deg_lat
        wind_dx_pm = u_deg_min_w / deg_lon_per_px
        wind_dy_pm = v_deg_min_w / deg_lat_per_px

    u_deg = [0.0] * n_tiles
    v_deg = [0.0] * n_tiles
    confs = [0.0] * n_tiles
    wets = [0.0] * n_tiles
    growth = [0.0] * n_tiles
    active = 0

    for ti in range(n_tiles):
        dxs, dys, cs = [], [], []
        wet_seen = 0.0
        for pt in pair_tiles:
            _, _, dx, dy, c, wet = pt[ti]
            wet_seen = max(wet_seen, wet)
            if c >= TILE_MIN_CONF:
                dxs.append(dx)
                dys.append(dy)
                cs.append(c)
        wets[ti] = round(wet_seen, 3)
        if dxs:
            dx_med = float(np.median(dxs))
            dy_med = float(np.median(dys))
            conf_med = float(np.median(cs))
        elif wind_dx_pm is not None:
            # Keine Radar-Evidenz: reiner Wind-Prior mit niedrigem Confidence.
            dx_med = wind_dx_pm
            dy_med = wind_dy_pm if wind_dy_pm is not None else 0.0
            conf_med = 0.05
        else:
            continue
        # Wind-Prior blenden: u = c·radar + (1−c)·wind (clamped).
        if wind_dx_pm is not None and conf_med < 0.9:
            w = conf_med
            dx_med = w * dx_med + (1 - w) * wind_dx_pm
            dy_med = w * dy_med + (1 - w) * (wind_dy_pm or 0.0)
        u_deg[ti] = round(dx_med * deg_lon_per_px, 6)
        v_deg[ti] = round(-dy_med * deg_lat_per_px, 6)  # Y-flip → +Norden
        confs[ti] = round(conf_med, 3)
        if dxs:
            active += 1

    # Per-Kachel Wachstums-/Zerfalls-Trend (relative Steigung pro Minute).
    try:
        ts0 = arrs[0][0]
        ts_min = np.array(
            [(t - ts0).total_seconds() / 60.0 for t, _ in arrs], dtype=np.float64
        )
        for r in range(rows):
            for c in range(cols):
                ti = r * cols + c
                cx = cxs[ti]
                cy = cys[ti]
                y0 = max(0, cy - TILE_PX // 2)
                y1 = min(arrs[0][1].shape[0], cy + TILE_PX // 2)
                x0 = max(0, cx - TILE_PX // 2)
                x1 = min(arrs[0][1].shape[1], cx + TILE_PX // 2)
                means = np.array(
                    [
                        float(np.nanmean(np.where(a[y0:y1, x0:x1] > 0.05, a[y0:y1, x0:x1], 0.0)))
                        for _, a in arrs
                    ],
                    dtype=np.float64,
                )
                base = float(np.nanmean(means)) if means.size else 0.0
                if base > 0.02 and len(arrs) >= 3:
                    slope = float(np.polyfit(ts_min, means, 1)[0])
                    g = slope / base
                    growth[ti] = round(float(max(-0.05, min(0.05, g))), 5)
    except Exception as exc:
        print(f"motion: field growth error {exc!r}", flush=True)

    return {
        "rows": rows,
        "cols": cols,
        "tile_px": TILE_PX,
        "stride_px": TILE_STRIDE,
        "image_w": OUT_W,
        "image_h": OUT_H,
        "cx_px": cxs,
        "cy_px": cys,
        "u_deg_per_min": u_deg,
        "v_deg_per_min": v_deg,
        "conf": confs,
        "wet": wets,
        "growth_per_min": growth,
        "active_tiles": active,
        "wind_prior_used": wind_dx_pm is not None,
    }



def write_manifest(s3, motion: dict | None = None) -> None:
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
    if motion is not None:
        body["motion"] = motion
    else:
        # Sichtbar machen, dass dieser Run kein Motion-Result hatte (statt Key wegzulassen).
        body["motion"] = {"_empty": True, "reason": "compute_motion returned None"}
    if not sorted_frames:
        try:
            existing = s3.get_object(Bucket=BUCKET, Key="radar/frames.json")
            existing_body = json.loads(existing["Body"].read().decode("utf-8"))
            existing_count = len(existing_body.get("frames") or [])
            if existing_count:
                print(
                    f"manifest: keeping existing {existing_count} frames; current run found 0 frames",
                    flush=True,
                )
                return
        except Exception as exc:
            print(f"manifest: no existing manifest to keep ({exc!r})", flush=True)
    s3.put_object(
        Bucket=BUCKET,
        Key="radar/frames.json",
        Body=json.dumps(body).encode("utf-8"),
        ContentType="application/json",
        CacheControl="public, max-age=30",
    )
    print(
        f"manifest: {len(sorted_frames)} frames, motion={'yes' if motion else 'no'}",
        flush=True,
    )


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
            key = f"radar/{a.product}/{a.ts.strftime('%Y%m%dT%H%M')}.png"
            if head_exists(s3, key):
                skipped_existing += 1
                continue
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

    # Nowcast-Motion aus den letzten 3 echten Radar-Frames per FFT-Phasen-
    # korrelation. Wird in frames.json geschrieben und vom Server-FN zur
    # Erzeugung von Nowcast-Frames (T+0…+60min) genutzt.
    motion: dict | None = None
    try:
        motion = compute_motion(precip_assets_all)
    except Exception as exc:
        print(f"motion: error {exc!r}", flush=True)

    cleanup(s3, now - timedelta(hours=RETENTION))
    write_manifest(s3, motion=motion)
    print(f"done: processed {processed} new frames", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
