#!/usr/bin/env python3
"""Gemessene Niederschlagssummen aus MeteoSchweiz CombiPrecip (CPC).

CombiPrecip = Radar + Bodenstationen, 60-Minuten-Summen. Wir nehmen pro
volle Stunde das CPC-Bild, das zu HH:00 UTC endet, schneiden es auf das
Oberthurgau-Raster zu und summieren 12/24/48/72 Stunden.

Inkrementell: die zugeschnittenen Stundenraster liegen in R2
(`radar/sums/hourly.npz`), damit pro Lauf nur neue Stunden geladen werden.
Ausgabe: `radar/sums/latest.json` (0.1-mm-Ganzzahlen, Zeilen von Süd nach Nord).

Wird aus ingest_radar.py aufgerufen, kann aber auch allein laufen.
"""
from __future__ import annotations

import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, STEP = 46.9, 48.1, 8.3, 10.6, 0.01
WINDOWS = (12, 24, 48, 72)
HOURLY_KEY = "radar/sums/hourly.npz"
OUT_KEY = "radar/sums/latest.json"
COLL = "ch.meteoschweiz.ogd-radar-precip"


def grid_axes() -> tuple[np.ndarray, np.ndarray]:
    lats = np.round(np.arange(LAT_MIN, LAT_MAX + 1e-9, STEP), 3)
    lons = np.round(np.arange(LON_MIN, LON_MAX + 1e-9, STEP), 3)
    return lats, lons


def sample_grid(values: np.ndarray, meta: dict) -> np.ndarray:
    """Nächster-Nachbar-Abtastung des CPC-Gitters auf das WGS84-Raster."""
    projdef = meta["projdef"] or (
        "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +x_0=600000 "
        "+y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs"
    )
    tr = Transformer.from_crs("EPSG:4326", projdef, always_xy=True)
    ll_x, ll_y = tr.transform(meta["LL_lon"], meta["LL_lat"])
    ur_x, ur_y = tr.transform(meta["UR_lon"], meta["UR_lat"])
    h, w = values.shape
    dx, dy = (ur_x - ll_x) / w, (ur_y - ll_y) / h
    lats, lons = grid_axes()
    lo, la = np.meshgrid(lons, lats)  # Zeile 0 = Süden
    xs, ys = tr.transform(lo.ravel(), la.ravel())
    cols = ((xs - ll_x) / dx).astype(np.int32)
    rows = ((ur_y - ys) / dy).astype(np.int32)
    ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
    out = np.full(lo.size, np.nan, dtype=np.float32)
    out[ok] = values[rows[ok], cols[ok]]
    return out.reshape(lo.shape)


def window_sums(hourly: dict[datetime, np.ndarray], now_hour: datetime) -> tuple[dict[int, np.ndarray], dict[int, int]]:
    """Summen je Fenster; fehlende Stunden werden gezählt, nicht als 0 erfunden."""
    sums: dict[int, np.ndarray] = {}
    missing: dict[int, int] = {}
    shape = next(iter(hourly.values())).shape if hourly else grid_axes()[0].shape
    for w in WINDOWS:
        acc = np.zeros(shape, dtype=np.float32)
        miss = 0
        for k in range(w):
            ts = now_hour - timedelta(hours=k)
            g = hourly.get(ts)
            if g is None:
                miss += 1
                continue
            acc += np.nan_to_num(g, nan=0.0)
        sums[w] = acc
        missing[w] = miss
    return sums, missing


def _list_cpc_hourly(since: datetime) -> dict[datetime, str]:
    from ingest_radar import STAC_BASE, http_get, parse_ts_from_filename, _filename_from_asset

    out: dict[datetime, str] = {}
    now = datetime.now(timezone.utc)
    for off in range(0, 5):
        day = (now - timedelta(days=off)).strftime("%Y%m%d")
        try:
            r = http_get(f"{STAC_BASE}/{COLL}/items/{day}-ch", timeout=30)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            for key, a in (r.json().get("assets") or {}).items():
                name = _filename_from_asset(key, a)
                if not name.startswith("cpc") or "_00060" not in name:
                    continue
                ts = parse_ts_from_filename(name)
                if ts and ts.minute == 0 and ts >= since and a.get("href"):
                    out[ts] = a["href"]
        except Exception as exc:  # noqa: BLE001
            print(f"  sums: STAC {day} error {exc!r}", flush=True)
    return out


def run(s3, bucket: str) -> None:
    from ingest_radar import http_get, read_h5_grid

    now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    keep_since = now_hour - timedelta(hours=max(WINDOWS) + 2)

    hourly: dict[datetime, np.ndarray] = {}
    try:
        obj = s3.get_object(Bucket=bucket, Key=HOURLY_KEY)
        with np.load(io.BytesIO(obj["Body"].read())) as z:
            for k in z.files:
                ts = datetime.fromisoformat(k)
                if ts >= keep_since:
                    hourly[ts] = z[k].astype(np.float32) / 10.0
    except Exception as exc:  # noqa: BLE001
        print(f"  sums: no hourly cache ({exc.__class__.__name__})", flush=True)

    lats, lons = grid_axes()
    hourly = {t: g for t, g in hourly.items() if g.shape == (len(lats), len(lons))}

    available = _list_cpc_hourly(keep_since)
    todo = sorted(t for t in available if t not in hourly)
    print(f"  sums: cached={len(hourly)} available={len(available)} new={len(todo)}", flush=True)
    for ts in todo:
        try:
            buf = http_get(available[ts], timeout=60).content
            arr, meta = read_h5_grid(buf)
            hourly[ts] = np.clip(sample_grid(arr, meta), 0, 500)
        except Exception as exc:  # noqa: BLE001
            print(f"  sums: {ts.isoformat()} failed {exc!r}", flush=True)

    if not hourly:
        print("  sums: no data, skip publish", flush=True)
        return

    latest = max(hourly)
    sums, missing = window_sums(hourly, latest)

    bio = io.BytesIO()
    np.savez_compressed(
        bio,
        **{t.isoformat(): np.round(np.nan_to_num(g) * 10).astype(np.uint16) for t, g in hourly.items() if t >= keep_since},
    )
    s3.put_object(Bucket=bucket, Key=HOURLY_KEY, Body=bio.getvalue(), ContentType="application/octet-stream")

    body = {
        "t": latest.isoformat().replace("+00:00", "Z"),
        "gridLat": lats.tolist(),
        "gridLon": lons.tolist(),
        "unit": "0.1mm",
        "missingHours": {str(w): missing[w] for w in WINDOWS},
        "sums": {str(w): np.round(sums[w] * 10).astype(int).ravel().tolist() for w in WINDOWS},
        "source": "MeteoSchweiz CombiPrecip (Radar + Stationen)",
    }
    s3.put_object(
        Bucket=bucket,
        Key=OUT_KEY,
        Body=json.dumps(body, separators=(",", ":")).encode(),
        ContentType="application/json",
        CacheControl="public, max-age=300",
    )
    print(f"  sums: published {OUT_KEY} up to {body['t']} missing={body['missingHours']}", flush=True)


if __name__ == "__main__":
    from ingest_radar import make_s3, BUCKET

    run(make_s3(), BUCKET)
