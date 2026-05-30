#!/usr/bin/env python3
"""
AROME-France-HD (Meteo-France, ~1.3 km nativ) → Cloudflare R2.

Holt stündliche Niederschlagsprognose aus Open-Meteo
(`models=meteofrance_arome_france_hd`) auf einem dichten Grid über
Oberthurgau, rendert pro Forecast-Stunde ein RGBA-PNG (bicubic-upsampled),
lädt es nach R2 und schreibt ein Manifest `arome/frames.json`.

Frontend (src/lib/radar.functions.ts) bietet einen Toggle „AROME-HD" an, der
diese PNGs als Leaflet `ImageOverlay` rendert — analog zu den CPC-Radar-PNGs.

ENV (required):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_URL

ENV (optional):
  AROME_OUT_PREFIX     default "arome"
  AROME_FORECAST_HOURS default 42
  BBOX_MIN_LAT/MAX_LAT/MIN_LON/MAX_LON  default = Oberthurgau-weit
  GRID_LAT (default 40), GRID_LON (default 60)
  CHUNK_SIZE (default 50)
  BATCH_SLEEP_S (default 3.0)
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from datetime import datetime, timezone

import boto3
import numpy as np
import requests
from PIL import Image

VERSION = "arome-hd-v1"
API = "https://api.open-meteo.com/v1/forecast"


# ---------------------------------------------------------------------------
# Env helpers
# ---------------------------------------------------------------------------


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing required env var: {name}")
    return v


def envf(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def envi(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BBOX = {
    "minLat": envf("BBOX_MIN_LAT", 47.20),
    "maxLat": envf("BBOX_MAX_LAT", 47.95),
    "minLon": envf("BBOX_MIN_LON", 8.70),
    "maxLon": envf("BBOX_MAX_LON", 10.00),
}
N_LAT = envi("GRID_LAT", 40)
N_LON = envi("GRID_LON", 60)
CHUNK = envi("CHUNK_SIZE", 50)
SLEEP_S = float(os.environ.get("BATCH_SLEEP_S", "3.0"))
HORIZON_H = envi("AROME_FORECAST_HOURS", 42)
OUT_PREFIX = os.environ.get("AROME_OUT_PREFIX", "arome").strip("/")

# Output PNG-Auflösung (Web-Mercator-Pixel). 8× Upsampling vom Native-Grid.
OUT_W = N_LON * 8
OUT_H = N_LAT * 8

# Niederschlags-Farbskala (mm/h → RGBA). Identisch zur Radar-Palette
# (PRECIP_SCALE in scripts/ingest_radar.py und SCALE in radar-map.tsx).
# Reihenfolge: aufsteigend nach Schwellenwert.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.2, (167, 174, 211, 89)),
    (1.0, (30, 60, 230, 153)),
    (2.0, (30, 120, 50, 153)),
    (4.0, (70, 200, 70, 153)),
    (6.0, (240, 235, 50, 153)),
    (10.0, (240, 200, 120, 153)),
    (20.0, (240, 140, 30, 153)),
    (40.0, (225, 30, 30, 153)),
    (60.0, (150, 30, 200, 153)),
]


# ---------------------------------------------------------------------------
# Grid + Fetch
# ---------------------------------------------------------------------------


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def build_grid() -> tuple[list[float], list[float], list[tuple[float, float]]]:
    lats = [
        BBOX["minLat"] + (BBOX["maxLat"] - BBOX["minLat"]) * i / (N_LAT - 1)
        for i in range(N_LAT)
    ]
    lons = [
        BBOX["minLon"] + (BBOX["maxLon"] - BBOX["minLon"]) * j / (N_LON - 1)
        for j in range(N_LON)
    ]
    pts = [(la, lo) for la in lats for lo in lons]
    return lats, lons, pts


def fetch(label: str, params: dict) -> list:
    backoff_429 = [65, 65, 90, 120]
    backoff_other = [3, 10, 30, 90]
    last_err: Exception | None = None
    last_429 = False
    for attempt in range(4):
        last_429 = False
        try:
            r = requests.get(API, params=params, timeout=120)
            if r.ok:
                data = r.json()
                return data if isinstance(data, list) else [data]
            if r.status_code == 429:
                last_err = RuntimeError(f"HTTP 429: {r.text[:200]}")
                last_429 = True
            elif 400 <= r.status_code < 500:
                sys.exit(f"open-meteo HTTP {r.status_code} ({label}): {r.text[:300]}")
            else:
                last_err = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
            requests.exceptions.SSLError,
        ) as e:
            last_err = e
        wait = backoff_429[attempt] if last_429 else backoff_other[attempt]
        print(f"WARN: {label} attempt {attempt + 1}/4 failed ({last_err}); retry in {wait}s")
        time.sleep(wait)
    sys.exit(f"open-meteo {label} failed: {last_err}")


def chunk_fetch(pts: list[tuple[float, float]]) -> list:
    out: list = []
    n_batches = (len(pts) + CHUNK - 1) // CHUNK
    base = {
        "hourly": "precipitation",
        "forecast_hours": HORIZON_H,
        "timezone": "UTC",
        "models": "meteofrance_arome_france_hd",
    }
    for bi in range(n_batches):
        batch = pts[bi * CHUNK : (bi + 1) * CHUNK]
        params = dict(base)
        params["latitude"] = ",".join(f"{p[0]:.4f}" for p in batch)
        params["longitude"] = ",".join(f"{p[1]:.4f}" for p in batch)
        label = f"arome batch {bi + 1}/{n_batches} ({len(batch)} pts)"
        res = fetch(label, params)
        out.extend(res)
        print(f"  {label} ok")
        if bi + 1 < n_batches:
            time.sleep(SLEEP_S)
    return out


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def build_frames(locs: list, lats: list[float], lons: list[float]) -> dict[str, np.ndarray]:
    """
    Pivot Open-Meteo-Locations zu {iso_time: 2D-Array[lat × lon]} in mm/h.

    Open-Meteo liefert pro Location ein Objekt mit hourly.time / hourly.precipitation.
    Die Reihenfolge der Locations entspricht der Reihenfolge in pts (row-major lat×lon).
    """
    if not locs:
        return {}
    times = locs[0].get("hourly", {}).get("time", []) or []
    if not times:
        return {}
    expected = N_LAT * N_LON
    if len(locs) != expected:
        print(f"WARN: locations {len(locs)} != expected {expected} — truncating")
    frames: dict[str, np.ndarray] = {}
    for ti, t in enumerate(times):
        arr = np.zeros((N_LAT, N_LON), dtype=np.float32)
        for idx in range(min(len(locs), expected)):
            row = idx // N_LON
            col = idx % N_LON
            v = (
                locs[idx]
                .get("hourly", {})
                .get("precipitation", [None] * len(times))[ti]
            )
            arr[row, col] = float(v) if isinstance(v, (int, float)) else 0.0
        # Open-Meteo liefert lat aufsteigend; PNG-Bbox geht von minLat (unten) bis
        # maxLat (oben). Leaflet `ImageOverlay` interpretiert PNG-Pixel (row 0 = top),
        # daher vertikal spiegeln, damit row 0 == maxLat.
        arr = np.flipud(arr)
        # ISO-Time normalisieren (Open-Meteo lässt "Z" oft weg)
        iso = t if t.endswith("Z") else t + ":00Z" if len(t) == 13 else (t + "Z")
        # Format ist meist "YYYY-MM-DDTHH:MM" → "YYYY-MM-DDTHH:MM:00Z"
        if len(t) == 16:
            iso = t + ":00Z"
        elif len(t) == 19:
            iso = t + "Z"
        frames[iso] = arr
    return frames


def render_png(values: np.ndarray) -> bytes:
    """Native NxM mm/h → bicubic-upsampled OUT_W×OUT_H RGBA-PNG."""
    # 1) Bicubic-Upsampling auf OUT_W × OUT_H mit Pillow (float-Modus "F")
    src = Image.fromarray(values.astype(np.float32), mode="F")
    up = src.resize((OUT_W, OUT_H), resample=Image.BICUBIC)
    smooth = np.asarray(up, dtype=np.float32)
    # Negative Werte (Bicubic-Overshoot) abschneiden
    np.clip(smooth, 0, None, out=smooth)

    # 2) Schwellen-basierte LUT → RGBA
    rgba = np.zeros((OUT_H, OUT_W, 4), dtype=np.uint8)
    for thresh, color in PRECIP_SCALE:
        mask = smooth >= thresh
        rgba[mask] = color
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# R2 Upload + Manifest
# ---------------------------------------------------------------------------


def iso_to_key_part(iso: str) -> str:
    # "2026-05-30T10:00:00Z" → "20260530T1000"
    return iso.replace("-", "").replace(":", "").replace("Z", "")[:13]


def public_url(base: str, key: str) -> str:
    trimmed = base.rstrip("/")
    return f"{trimmed}/{key}" if not trimmed.endswith(key) else trimmed


def cleanup_old(s3, bucket: str, prefix: str, keep_keys: set[str]) -> None:
    paginator = s3.get_paginator("list_objects_v2")
    deleted = 0
    for page in paginator.paginate(Bucket=bucket, Prefix=f"{prefix}/frames/"):
        for obj in page.get("Contents", []) or []:
            k = obj["Key"]
            if k in keep_keys:
                continue
            if not k.endswith(".png"):
                continue
            try:
                s3.delete_object(Bucket=bucket, Key=k)
                deleted += 1
            except Exception as e:
                print(f"WARN delete {k}: {e}")
    if deleted:
        print(f"cleanup: removed {deleted} stale frames")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print(f"AROME INGEST START version={VERSION}")
    print(f"bbox={BBOX} grid={N_LAT}x{N_LON} horizon={HORIZON_H}h chunk={CHUNK}")

    lats, lons, pts = build_grid()
    print(f"grid points: {len(pts)} — out {OUT_W}x{OUT_H}px")

    locs = chunk_fetch(pts)
    print(f"  fetched {len(locs)} locations")

    frames = build_frames(locs, lats, lons)
    if not frames:
        sys.exit("no frames built (empty hourly.time)")
    print(f"  built {len(frames)} hourly frames")

    s3 = make_s3()
    bucket = env("R2_BUCKET")
    public_base = env("R2_PUBLIC_URL").rstrip("/")

    manifest_frames: list[dict] = []
    keep_keys: set[str] = set()
    for iso, arr in sorted(frames.items()):
        key = f"{OUT_PREFIX}/frames/{iso_to_key_part(iso)}.png"
        png = render_png(arr)
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=png,
            ContentType="image/png",
            CacheControl="public, max-age=900, s-maxage=1800",
        )
        keep_keys.add(key)
        manifest_frames.append(
            {
                "t": iso,
                "url": f"{public_base}/{key}",
                "maxMmh": float(np.nanmax(arr)) if arr.size else 0.0,
            }
        )
    print(f"uploaded {len(manifest_frames)} frames")

    manifest = {
        "version": VERSION,
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "imageBbox": BBOX,
        "grid": {"lat": N_LAT, "lon": N_LON, "outW": OUT_W, "outH": OUT_H},
        "frames": manifest_frames,
    }
    manifest_key = f"{OUT_PREFIX}/frames.json"
    s3.put_object(
        Bucket=bucket,
        Key=manifest_key,
        Body=json.dumps(manifest, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
        CacheControl="public, max-age=60, s-maxage=120",
    )
    print(f"uploaded {manifest_key}")

    cleanup_old(s3, bucket, OUT_PREFIX, keep_keys)
    print("done")


if __name__ == "__main__":
    main()
