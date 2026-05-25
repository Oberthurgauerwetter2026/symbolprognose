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
  RADAR_LOOKBACK_HOURS  default 3
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

RADAR_INGEST_VERSION = "v3-diagnostics-fallback"
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

# Oberthurgau bounding box (WGS84).
BBOX_WGS = {"minLon": 9.00, "maxLon": 9.62, "minLat": 47.38, "maxLat": 47.72}

# Output PNG resolution (Web Mercator pixels). 512×384 keeps PNGs <20 KB.
OUT_W, OUT_H = 512, 384

LOOKBACK = int(os.environ.get("RADAR_LOOKBACK_HOURS", "3"))
RETENTION = int(os.environ.get("RADAR_RETENTION_HOURS", "24"))

# MeteoSchweiz CPC colour scale (mm/h → RGBA). < 0.1 mm/h = transparent.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.1, (200, 220, 245, 140)),
    (0.4, (160, 200, 240, 160)),
    (0.7, (120, 180, 235, 175)),
    (1.3, (80, 160, 220, 190)),
    (2.0, (60, 200, 140, 200)),
    (3.5, (60, 200, 60, 210)),
    (6.0, (220, 220, 60, 220)),
    (10.0, (240, 180, 40, 225)),
    (20.0, (240, 120, 40, 230)),
    (30.0, (235, 60, 60, 235)),
    (50.0, (200, 30, 90, 240)),
    (80.0, (170, 20, 130, 245)),
    (130.0, (140, 20, 180, 250)),
    (200.0, (120, 80, 220, 250)),
    (350.0, (200, 200, 255, 250)),
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
    year = 2000 + int(yy)
    base = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(
        days=int(doy) - 1, hours=int(hh), minutes=int(mm)
    )
    return base


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
            r = requests.get(url, timeout=30)
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
            r = requests.get(url, timeout=30)
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
                f"  NOTE: {len(ts_list)} assets found but all older than since "
                f"({since.isoformat()}). Falling back to newest 6.",
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


def process_asset(s3, asset: AssetRef) -> str | None:
    """Download → reproject → render → upload. Returns object key or None."""
    ts_iso = asset.ts.strftime("%Y%m%dT%H%M")
    key = f"radar/{asset.product}/{ts_iso}.png"
    if head_exists(s3, key):
        return key
    print(f"  fetching {asset.href}", flush=True)
    r = requests.get(asset.href, timeout=60)
    r.raise_for_status()
    values, meta = read_h5_grid(r.content)
    cropped = sample_to_bbox(values, meta)
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
    body = {
        "bbox": BBOX_WGS,
        "generatedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "frames": sorted_frames,
    }
    s3.put_object(
        Bucket=BUCKET,
        Key="radar/frames.json",
        Body=json.dumps(body).encode("utf-8"),
        ContentType="application/json",
        CacheControl="public, max-age=30",
    )
    print(f"manifest: {len(sorted_frames)} frames", flush=True)


def main() -> int:
    print(f"radar ingest {RADAR_INGEST_VERSION} lookback={LOOKBACK}h retention={RETENTION}h", flush=True)
    if not BUCKET or not PUBLIC_URL:
        sys.exit("R2_BUCKET and R2_PUBLIC_URL must be set")
    s3 = make_s3()
    now = datetime.now(tz=timezone.utc)
    since = now - timedelta(hours=LOOKBACK)

    processed = 0
    for product in COLLECTIONS:
        print(f"== {product} (since {since.isoformat()}) ==", flush=True)
        try:
            assets = list_recent_assets(product, since)
        except Exception as exc:
            print(f"  STAC error: {exc}", flush=True)
            continue
        print(f"  {len(assets)} candidate frames", flush=True)
        for a in assets:
            try:
                if process_asset(s3, a):
                    processed += 1
            except Exception as exc:
                print(f"  ! {a.key}: {exc}", flush=True)

    cleanup(s3, now - timedelta(hours=RETENTION))
    write_manifest(s3)
    print(f"done: processed {processed} new frames", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
