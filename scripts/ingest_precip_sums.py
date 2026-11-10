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

LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, STEP = 46.6, 48.6, 7.4, 11.6, 0.01
WINDOWS = (12, 24, 48, 72)
HOURLY_KEY = "radar/sums/hourly.npz"
PHASE_KEY = "radar/sums/phase.npz"
TEMP_KEY = "radar/sums/temp.npz"
# Wasserwert → Neuschnee wie im Modell (Open-Meteo: 1 mm ≈ 0.7 cm).
SNOW_CM_PER_MM = 0.7
# Unterhalb dieses Schneeanteils (Regen/nasser Schneeregen) bleibt nichts liegen.
SNOW_ACC_MIN_FRAC = 0.3
# Bodenwärme: auf schneefreiem, nicht gefrorenem Boden schmilzt anfangs so viel
# Neuschnee pro Stunde weg, bis eine Decke liegt (wie bei Wetterdiensten).
GROUND_LOSS_CM_H = 0.3
# Schmelzen einer bestehenden Decke (Grad-Stunden-Faktor, cm je °C und Stunde).
MELT_CM_PER_DEG_H = 0.1
# Temperatur-Platzhalter, wenn für eine Stunde keine Pixeltemperatur vorliegt.
NO_TEMP = 127
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


def snow_cm(mm: np.ndarray, frac: np.ndarray) -> np.ndarray:
    """Neuschnee (cm) aus gemessenem Wasserwert (mm) und Schneeanteil 0..1."""
    m = np.nan_to_num(np.asarray(mm, dtype=np.float32))
    f = np.clip(np.nan_to_num(np.asarray(frac, dtype=np.float32)), 0.0, 1.0)
    return np.where(f >= SNOW_ACC_MIN_FRAC, m * f * SNOW_CM_PER_MM, 0.0).astype(np.float32)


def resample_phase(frac: np.ndarray, bbox: dict) -> np.ndarray:
    """Phasenfeld (Radarraster, Zeile 0 = Norden) → Summenraster (Zeile 0 = Süden)."""
    h, w = frac.shape
    lats, lons = grid_axes()
    cols = np.clip(np.round((lons - bbox["minLon"]) / (bbox["maxLon"] - bbox["minLon"]) * (w - 1)), 0, w - 1).astype(int)
    rows = np.clip(np.round((bbox["maxLat"] - lats) / (bbox["maxLat"] - bbox["minLat"]) * (h - 1)), 0, h - 1).astype(int)
    return frac[np.ix_(rows, cols)].astype(np.float32)


def retained_step(pack: np.ndarray, new_cm: np.ndarray, temp_c: np.ndarray | None) -> tuple[np.ndarray, np.ndarray]:
    """Eine Stunde Liegenbleiben: (neue Decke, liegengebliebener Neuschnee).
    Ohne Decke frisst warmer Boden (T > 0 °C) zuerst GROUND_LOSS_CM_H;
    eine Decke schmilzt mit MELT_CM_PER_DEG_H je °C über 0. Ohne Temperatur
    zählt der Neuschnee voll (keine Erfindung von Schmelze)."""
    new = np.maximum(np.nan_to_num(new_cm), 0.0)
    if temp_c is None:
        return pack + new, new
    t = np.nan_to_num(np.asarray(temp_c, dtype=np.float32), nan=-99.0)
    warm = np.maximum(t, 0.0)
    bare = pack <= 0.05
    ground = np.where(bare & (t > 0.0), GROUND_LOSS_CM_H, 0.0)
    kept = np.maximum(new - ground - warm * MELT_CM_PER_DEG_H, 0.0)
    melt_pack = np.where(t > 0.0, warm * MELT_CM_PER_DEG_H, 0.0)
    return np.maximum(pack + kept - np.where(new > 0, 0.0, melt_pack), 0.0), kept.astype(np.float32)


def snow_window_sums(hourly: dict, phase: dict, now_hour: datetime, temps: dict | None = None) -> tuple[dict[int, np.ndarray], dict[int, int]]:
    """Liegengebliebener Radar-Neuschnee je Fenster (inkl. Bodenwärme/Schmelze).
    Stunden ohne Phase oder ohne Messung zählen als fehlend."""
    temps = temps or {}
    sums: dict[int, np.ndarray] = {}
    missing: dict[int, int] = {}
    shape = (len(grid_axes()[0]), len(grid_axes()[1]))
    for w in WINDOWS:
        acc = np.zeros(shape, dtype=np.float32)
        pack = np.zeros(shape, dtype=np.float32)
        miss = 0
        for k in range(w - 1, -1, -1):  # chronologisch, damit die Decke wächst
            ts = now_hour - timedelta(hours=k)
            g, f = hourly.get(ts), phase.get(ts)
            if g is None or f is None:
                miss += 1
                continue
            pack, kept = retained_step(pack, snow_cm(g, f), temps.get(ts))
            acc += kept
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


def run(s3, bucket: str, phase_at=None, phase_bbox: dict | None = None) -> None:
    """phase_at(ts) → Schneeanteil-Feld (Radarraster), np.zeros bei reinem
    Regen, None wenn die Atmosphäre für ts unbekannt ist."""
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

    # Phase je Messstunde (DEM + Stationen + Modell), inkrementell gespeichert.
    phase: dict[datetime, np.ndarray] = {}
    temps: dict[datetime, np.ndarray] = {}
    try:
        obj = s3.get_object(Bucket=bucket, Key=TEMP_KEY)
        with np.load(io.BytesIO(obj["Body"].read())) as z:
            for k in z.files:
                ts = datetime.fromisoformat(k)
                if ts >= keep_since and z[k].shape == (len(lats), len(lons)):
                    raw = z[k].astype(np.float32)
                    temps[ts] = np.where(raw == NO_TEMP, np.nan, raw / 2.0)
    except Exception as exc:  # noqa: BLE001
        print(f"  sums: no temp cache ({exc.__class__.__name__})", flush=True)
    try:
        obj = s3.get_object(Bucket=bucket, Key=PHASE_KEY)
        with np.load(io.BytesIO(obj["Body"].read())) as z:
            for k in z.files:
                ts = datetime.fromisoformat(k)
                if ts >= keep_since and z[k].shape == (len(lats), len(lons)):
                    phase[ts] = z[k].astype(np.float32) / 100.0
    except Exception as exc:  # noqa: BLE001
        print(f"  sums: no phase cache ({exc.__class__.__name__})", flush=True)
    if phase_at is not None and phase_bbox is not None:
        for ts in sorted(t for t in hourly if t not in phase):
            try:
                res = phase_at(ts - timedelta(minutes=30))  # Mitte der Stunde
                if res is not None:
                    f, tp = res if isinstance(res, tuple) else (res, None)
                    phase[ts] = resample_phase(f, phase_bbox)
                    if tp is not None:
                        temps[ts] = resample_phase(tp, phase_bbox)
            except Exception as exc:  # noqa: BLE001
                print(f"  sums: phase {ts.isoformat()} failed {exc!r}", flush=True)
        try:
            pio = io.BytesIO()
            np.savez_compressed(pio, **{t.isoformat(): np.round(f * 100).astype(np.uint8) for t, f in phase.items() if t >= keep_since})
            s3.put_object(Bucket=bucket, Key=PHASE_KEY, Body=pio.getvalue(), ContentType="application/octet-stream")
            tio = io.BytesIO()
            np.savez_compressed(tio, **{
                t.isoformat(): np.where(np.isfinite(v), np.clip(np.round(v * 2), -120, 120), NO_TEMP).astype(np.int8)
                for t, v in temps.items() if t >= keep_since
            })
            s3.put_object(Bucket=bucket, Key=TEMP_KEY, Body=tio.getvalue(), ContentType="application/octet-stream")
        except Exception as exc:  # noqa: BLE001
            print(f"  sums: phase cache write failed {exc!r}", flush=True)
    snow_sums, snow_missing = snow_window_sums(hourly, phase, latest, temps)

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
        "snowUnit": "0.1cm",
        "snowMissingHours": {str(w): snow_missing[w] for w in WINDOWS},
        "snow": {str(w): np.round(snow_sums[w] * 10).astype(int).ravel().tolist() for w in WINDOWS},
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
