#!/usr/bin/env python3
"""
Open-Meteo -> Cloudflare R2 Cache (Oberthurgau / Symbolprognose).

3-Phasen-Schema (analog Amriswil-Projekt):

  phase1 / phaseB  ICON-CH1 minutely_15 precipitation, -12h … +33h
                   (Radar / Nowcast — bestehender Frame-Erzeuger)
  phase2           ICON-CH2 hourly precipitation, +0 … +6 d
                   (Radar Phase-2 Forecast — Single-Modell)
  phaseA           Multi-Modell hourly+daily, +0 … +7 d
                   (Symbolprognose, Wochenforecast)
  phaseC           Bias-Lookback hourly, -7 d … +1 d, best_match
                   (für statistische Korrekturen / Reviews)

phase1 + phase2 bleiben für Backwards-Compat mit src/lib/radar.functions.ts.

ENV (required):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
ENV (optional):
  OPENMETEO_OUT_KEY  default "openmeteo/forecast.json"
  BBOX_MIN_LAT/MAX_LAT/MIN_LON/MAX_LON  default = Oberthurgau
  GRID_LAT (default 9), GRID_LON (default 14)
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import boto3
import requests

VERSION = "oberthurgau-openmeteo-cache-v5-ch1-native-pngs"
API = "https://api.open-meteo.com/v1/forecast"

# Farbskala (mm/h → RGBA) — MUSS mit
# scripts/ingest_radar.py::PRECIP_SCALE und SCALE in
# src/components/maps/radar-map.tsx übereinstimmen.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.1,   (150, 195, 235, 235)),
    (0.3,   ( 95, 155, 220, 255)),
    (0.8,   ( 40,  90, 195, 255)),
    (2.0,   ( 55, 170,  75, 255)),
    (5.0,   (245, 220,  55, 255)),
    (15.0,  (240, 140,  35, 255)),
    (40.0,  (220,  40,  40, 255)),
    (80.0,  (170,  40, 180, 255)),
]


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing required env var: {name}")
    return v


def envf(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def envi(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def _bbox():
    return {
        "min_lat": envf("BBOX_MIN_LAT", 46.85),
        "max_lat": envf("BBOX_MAX_LAT", 48.30),
        "min_lon": envf("BBOX_MIN_LON", 8.15),
        "max_lon": envf("BBOX_MAX_LON", 10.55),
    }


def build_grid():
    """Grobe Radar/Wind-/Bias-Punkte (~5–7 km) — Kompat-Grid für phase2/A/C
    und für den bias-correction-Pfad in radar.functions.ts."""
    bb = _bbox()
    n_lat = envi("GRID_LAT", 22)
    n_lon = envi("GRID_LON", 36)
    lats = [bb["min_lat"] + (bb["max_lat"] - bb["min_lat"]) * i / (n_lat - 1) for i in range(n_lat)]
    lons = [bb["min_lon"] + (bb["max_lon"] - bb["min_lon"]) * j / (n_lon - 1) for j in range(n_lon)]
    return [(la, lo) for la in lats for lo in lons]


def build_grid_dense():
    """Native-Auflösung fürs Prognose-Raster (~1 km, ICON-CH1 native).
    Ausschliesslich für die PNG-Rasterung genutzt; Werte werden NICHT als
    grosse Zahlenlisten an den Client geschickt."""
    bb = _bbox()
    n_lat = envi("GRID_LAT_DENSE", 120)
    n_lon = envi("GRID_LON_DENSE", 140)
    lats = [bb["min_lat"] + (bb["max_lat"] - bb["min_lat"]) * i / (n_lat - 1) for i in range(n_lat)]
    lons = [bb["min_lon"] + (bb["max_lon"] - bb["min_lon"]) * j / (n_lon - 1) for j in range(n_lon)]
    pts = [(la, lo) for la in lats for lo in lons]
    return lats, lons, pts



def fetch(label: str, params: dict, optional: bool = False) -> list | None:
    # 429 = Minutenlimit -> volle Minute warten (API sagt explizit "try again in one minute").
    backoff_429 = [65, 65, 70, 90, 120, 150, 180]
    backoff_other = [10, 20, 45, 90, 180, 240, 300]
    max_attempts = len(backoff_other)
    connect_to = float(os.environ.get("OM_CONNECT_TIMEOUT", "15"))
    read_to = float(os.environ.get("OM_READ_TIMEOUT", "120"))
    import random
    last_err: Exception | None = None
    last_was_429 = False
    for attempt in range(max_attempts):
        last_was_429 = False
        try:
            r = requests.get(API, params=params, timeout=(connect_to, read_to))
            if not r.ok:
                if r.status_code == 429:
                    last_err = RuntimeError(f"HTTP 429 rate-limited: {r.text[:200]}")
                    last_was_429 = True
                elif 400 <= r.status_code < 500:
                    msg = f"open-meteo HTTP {r.status_code} ({label}): {r.text[:300]}"
                    if optional:
                        print(f"WARN: {msg} — skipping (optional)")
                        return None
                    sys.exit(msg)
                else:
                    last_err = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
            else:
                data = r.json()
                return data if isinstance(data, list) else [data]
        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
            requests.exceptions.SSLError,
        ) as e:
            last_err = e
        base_wait = backoff_429[attempt] if last_was_429 else backoff_other[attempt]
        wait = base_wait * (0.8 + 0.4 * random.random())  # ±20 % jitter
        print(
            f"WARN: {label} attempt {attempt + 1}/{max_attempts} failed ({last_err}); "
            f"retry in {wait:.1f}s"
        )
        time.sleep(wait)
    msg = f"open-meteo {label} failed after {max_attempts} attempts: {last_err}"
    if optional:
        print(f"WARN: {msg} — skipping (optional)")
        return None
    sys.exit(msg)






def chunk_fetch(label: str, base_params: dict, pts: list, chunk_size: int, optional: bool = False) -> list | None:
    """Open-Meteo Bulk-Requests in Batches, parallelisiert mit kleinem ThreadPool.

    Reihenfolge der Ergebnisse entspricht strikt der Eingabe-Punktliste,
    damit phaseX[i] weiter zu pts[i] passt.
    """
    total = len(pts)
    n_batches = (total + chunk_size - 1) // chunk_size
    try:
        workers = max(1, int(os.environ.get("FETCH_WORKERS", "2")))
    except ValueError:
        workers = 2

    results: list[list | None] = [None] * n_batches

    def run(bi: int):
        batch = pts[bi * chunk_size : (bi + 1) * chunk_size]
        params = dict(base_params)
        params["latitude"] = ",".join(f"{p[0]:.4f}" for p in batch)
        params["longitude"] = ",".join(f"{p[1]:.4f}" for p in batch)
        sub_label = f"{label} batch {bi + 1}/{n_batches} ({len(batch)} pts)"
        res = fetch(sub_label, params, optional=optional)
        return bi, sub_label, res

    try:
        batch_sleep = float(os.environ.get("BATCH_SLEEP_S", "0"))
    except ValueError:
        batch_sleep = 0.0

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(run, bi) for bi in range(n_batches)]
        for idx, fut in enumerate(futures):
            bi, sub_label, res = fut.result()
            if res is None:
                print(f"WARN: {label} skipped due to batch {bi + 1} failure (optional)")
                return None
            results[bi] = res
            print(f"  {sub_label} ok")
            if batch_sleep > 0 and idx < len(futures) - 1:
                time.sleep(batch_sleep)

    out: list = []
    for r in results:
        if r is None:
            return None
        out.extend(r)
    return out



def read_existing_payload(s3, bucket: str, key: str) -> dict | None:
    """Letzten R2-Cache lesen, um phase1 bei Open-Meteo-Ausfall wiederzuverwenden."""
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read())
    except Exception as e:
        print(f"WARN: could not read existing {key}: {e}")
        return None


def _envflag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


# ---------------------------------------------------------------------------
# Prognose-PNG-Rasterung (ICON-CH1 minutely_15 → native ~1 km PNGs).
# Analog zum Messungs-Ingest (scripts/ingest_radar.py) — dieselbe Farbskala,
# damit Prognose- und Messungs-Frames im Client identisch aussehen.
# ---------------------------------------------------------------------------

def _index_minutely_times(loc: dict) -> dict[str, int]:
    times = ((loc or {}).get("minutely_15") or {}).get("time") or []
    return {t: i for i, t in enumerate(times)}


def _render_frame_png(n_lat: int, n_lon: int, mmh_row_major: list[float]) -> bytes:
    """`mmh_row_major` ist [lat_asc * lon_asc] mit len = n_lat*n_lon.
    Rendert ein n_lon × n_lat RGBA-PNG mit PRECIP_SCALE; Zeile 0 = maxLat."""
    import numpy as np
    from PIL import Image

    arr = np.asarray(mmh_row_major, dtype=np.float32).reshape(n_lat, n_lon)
    # Bildzeile 0 muss max_lat entsprechen (PNG top-left = NW).
    arr = np.flipud(arr)
    rgba = np.zeros((n_lat, n_lon, 4), dtype=np.uint8)
    for thresh, color in PRECIP_SCALE:
        mask = np.isfinite(arr) & (arr >= thresh)
        rgba[mask] = color
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _purge_forecast_pngs(s3, bucket: str) -> int:
    paginator = s3.get_paginator("list_objects_v2")
    purged = 0
    for page in paginator.paginate(Bucket=bucket, Prefix="radar/forecast/"):
        for obj in page.get("Contents", []) or []:
            s3.delete_object(Bucket=bucket, Key=obj["Key"])
            purged += 1
    return purged


def rasterize_forecast_pngs(
    s3,
    bucket: str,
    public_url: str,
    lats: list[float],
    lons: list[float],
    phase1_dense: list | None,
) -> list[dict]:
    """Baut aus `phase1_dense` (ICON-CH1 minutely_15) für jeden 15-min-Slot
    ab jetzt bis +48 h ein PNG und lädt es nach `radar/forecast/<ISO>.png`.
    Gibt eine Liste von Manifest-Einträgen zurück."""
    if not phase1_dense or not lats or not lons:
        print("forecast-pngs: no phase1_dense data — skipping")
        return []

    n_lat = len(lats)
    n_lon = len(lons)
    n_pts = n_lat * n_lon
    if len(phase1_dense) != n_pts:
        print(
            f"forecast-pngs: dense grid mismatch ({len(phase1_dense)} vs {n_pts}) — skipping",
        )
        return []

    # Zeit-Achse aus dem ersten Punkt lesen; alle Punkte teilen dieselbe.
    ref_times: list[str] = ((phase1_dense[0] or {}).get("minutely_15") or {}).get("time") or []
    if not ref_times:
        print("forecast-pngs: no minutely_15 times in phase1 — skipping")
        return []

    # Pro Punkt: Zeit-Index → Value-Array (mm pro 15 min → mm/h × 4).
    per_pt_precip: list[list[float | None]] = []
    for loc in phase1_dense:
        m = (loc or {}).get("minutely_15") or {}
        precip = m.get("precipitation") or []
        per_pt_precip.append(precip)

    # ISO in UTC. Open-Meteo minutely_15 kommt ohne Timezone-Suffix.
    now = datetime.now(tz=timezone.utc)
    horizon = now + timedelta(hours=48)
    past = now - timedelta(hours=1)

    _purged = _purge_forecast_pngs(s3, bucket)
    if _purged:
        print(f"forecast-pngs: purged {_purged} old objects")

    manifest_entries: list[dict] = []
    uploaded = 0
    for ti, t_iso in enumerate(ref_times):
        try:
            t_dt = datetime.fromisoformat(t_iso).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if t_dt < past or t_dt > horizon:
            continue
        # Werte pro Grid-Punkt aggregieren; None → 0.
        frame_vals: list[float] = [0.0] * n_pts
        any_positive = False
        for pi in range(n_pts):
            arr = per_pt_precip[pi]
            v = arr[ti] if ti < len(arr) else None
            if v is None:
                frame_vals[pi] = 0.0
            else:
                fv = float(v) * 4.0  # mm/15min → mm/h
                if fv > 0.05:
                    any_positive = True
                frame_vals[pi] = fv

        # Auch komplett trockene Frames rendern (leerer PNG), damit die
        # Timeline lückenlos bleibt. Nutzt die "any_positive" nur für Logging.
        png = _render_frame_png(n_lat, n_lon, frame_vals)
        # Dateiname: YYYYMMDDTHHMM.png, Zeit auf 15-min gerundet.
        stamp = t_dt.strftime("%Y%m%dT%H%M")
        key = f"radar/forecast/{stamp}.png"
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=png,
            ContentType="image/png",
            CacheControl="public, max-age=31536000, immutable",
        )
        uploaded += 1
        manifest_entries.append({
            "t": t_dt.strftime("%Y-%m-%dT%H:%M:00Z"),
            "precipUrl": f"{public_url.rstrip('/')}/{key}",
            "source": "icon-ch1",
            "hasPrecip": any_positive,
        })
    print(f"forecast-pngs: uploaded {uploaded} frames")
    return manifest_entries


def write_forecast_manifest(s3, bucket: str, frames: list[dict]) -> None:
    bb = _bbox()
    body: dict = {
        "bbox": {
            "minLat": bb["min_lat"],
            "maxLat": bb["max_lat"],
            "minLon": bb["min_lon"],
            "maxLon": bb["max_lon"],
        },
        "generatedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": VERSION,
        "frames": sorted(frames, key=lambda f: f["t"]),
    }
    s3.put_object(
        Bucket=bucket,
        Key="radar/forecast-frames.json",
        Body=json.dumps(body, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
        CacheControl="public, max-age=30",
    )
    print(f"forecast-manifest: {len(frames)} entries")


def downsample_phase1(
    dense_lats: list[float],
    dense_lons: list[float],
    phase1_dense: list,
    sparse_pts: list[tuple[float, float]],
) -> list:
    """Weist jedem Sparse-Punkt den nächsten Dense-Punkt zu. Bewahrt die
    bestehende Struktur (minutely_15/hourly) 1:1, damit
    radar.functions.ts und Bias-Korrektur unverändert weiterlaufen."""
    if not phase1_dense:
        return []
    n_lon = len(dense_lons)
    n_lat = len(dense_lats)
    if len(phase1_dense) != n_lat * n_lon:
        return phase1_dense  # Struktur unbekannt → weiterreichen
    out: list = []
    for la, lo in sparse_pts:
        # Nächster Index in lats/lons.
        i_lat = min(range(n_lat), key=lambda i: abs(dense_lats[i] - la))
        i_lon = min(range(n_lon), key=lambda j: abs(dense_lons[j] - lo))
        out.append(phase1_dense[i_lat * n_lon + i_lon])
    return out



def main() -> None:
    skip_phaseA = _envflag("SKIP_PHASEA")
    only_phaseA = _envflag("ONLY_PHASEA")
    if skip_phaseA and only_phaseA:
        sys.exit("SKIP_PHASEA and ONLY_PHASEA are mutually exclusive")

    mode = "ONLY_PHASEA" if only_phaseA else ("SKIP_PHASEA" if skip_phaseA else "FULL")
    print(f"OPENMETEO INGEST START version={VERSION} mode={mode}")
    pts = build_grid()
    dense_lats, dense_lons, dense_pts = build_grid_dense()
    print(
        f"grid points: sparse={len(pts)} dense={len(dense_pts)} "
        f"({len(dense_lats)}×{len(dense_lons)} ≈ native ICON-CH1)"
    )

    # phase1: ICON-CH1 — minutely_15 für Radar/Nowcast (15-min-Schiene gibt es
    # nur bei CH1), zusätzlich hourly Wind-Felder für die nahtlose
    # CH1→CH2-Verkettung der Windanimation (+0…+33h).
    p1 = {
        "minutely_15": "precipitation,snowfall",
        "past_minutely_15": 48,
        "forecast_minutely_15": 132,
        "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "past_hours": 12,
        "forecast_hours": 33,
        "timezone": "UTC",
        "models": "meteoswiss_icon_ch1",
    }
    # phase2: ICON-CH2 hourly (-12h … +120h) — nahtlose CH1-Verlängerung
    # (CH1 deckt ~+33h ab, CH2 schliesst lückenlos bis +120h an). Bewusst NICHT
    # icon_seamless, damit Radar-Prognose ausschliesslich aus dem ICON-CH-Stack
    # kommt (kein Übergang nach ICON-EU/global im Sichtfenster).
    p2 = {
        "hourly": "precipitation,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_700hPa,wind_direction_700hPa",
        "past_hours": 12,
        "forecast_hours": 120,
        "timezone": "UTC",
        "models": "meteoswiss_icon_ch2",
    }
    # phaseA: Multi-Modell hourly+daily 7 d — Symbolprognose Hot-Path
    pa = {
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "precipitation_probability",
            "weathercode",
            "cloudcover",
            "cloud_cover_low",
            "cloud_cover_mid",
            "cloud_cover_high",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m",
            "pressure_msl",
            "snowfall",
            "sunshine_duration",
        ]),
        "daily": ",".join([
            "weathercode",
            "temperature_2m_min",
            "temperature_2m_max",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "wind_direction_10m_dominant",
            "sunshine_duration",
            "sunrise",
            "sunset",
            "snowfall_sum",
        ]),
        "forecast_days": 7,
        "timezone": "Europe/Zurich",
        "models": "icon_seamless,icon_d2,arpege_europe,meteofrance_arome_france_hd,gfs_global",
    }
    # phaseC: Bias-Lookback (-7 d … +1 d) best_match
    pc = {
        "hourly": "temperature_2m,wind_speed_10m,precipitation",
        "past_days": 7,
        "forecast_days": 1,
        "timezone": "Europe/Zurich",
        "models": "best_match",
    }

    chunk_p1 = envi("CHUNK_PHASE1", 15)
    chunk_p2 = envi("CHUNK_PHASE2", 20)
    chunk_pa = envi("CHUNK_PHASEA", 20)
    chunk_pc = envi("CHUNK_PHASEC", 40)

    key = os.environ.get("OPENMETEO_OUT_KEY", "openmeteo/forecast.json")
    s3 = make_s3()
    bucket = env("R2_BUCKET")

    # Bestehenden Cache laden — wird je nach Mode für übersprungene Phasen
    # weiterverwendet, damit forecast.json immer ein vollständiges Set behält.
    prev = read_existing_payload(s3, bucket, key) or {}

    # ---- phase1 (Radar/Nowcast) auf dichtem Native-Grid für PNG-Rasterung ----
    r2_public_url = os.environ.get("R2_PUBLIC_URL") or ""
    if only_phaseA:
        phase1 = prev.get("phase1") or prev.get("phaseB") or []
        phase1_dense = None
        print(f"phase1 übernommen aus Cache: {len(phase1)} locations")
    else:
        print(
            f"fetch phase1 dense (ICON-CH1 minutely_15, {len(dense_pts)} pts) "
            f"in chunks of {chunk_p1} …"
        )
        phase1_dense = chunk_fetch("phase1", p1, dense_pts, chunk_p1, optional=True)
        if phase1_dense is None:
            print("phase1 dense failed — versuche Fallback auf bestehenden R2-Cache …")
            prev_phase1 = prev.get("phase1") or prev.get("phaseB")
            if isinstance(prev_phase1, list) and prev_phase1:
                phase1 = prev_phase1
                print(f"  -> Fallback ok: {len(phase1)} locations aus bestehendem Cache")
            else:
                sys.exit("phase1 failed and no cached fallback available")
        else:
            print(f"  -> {len(phase1_dense)} dense locations")
            # Für R2-JSON auf Sparse-Grid herunterrechnen (kompaktes Payload,
            # gleiche Struktur wie bisher).
            phase1 = downsample_phase1(dense_lats, dense_lons, phase1_dense, pts)
            print(f"  -> downsampled to sparse: {len(phase1)} locations")

    # ---- Prognose-PNGs rasterisieren + Manifest schreiben ----
    if phase1_dense and r2_public_url:
        try:
            forecast_frames = rasterize_forecast_pngs(
                s3, bucket, r2_public_url, dense_lats, dense_lons, phase1_dense
            )
            write_forecast_manifest(s3, bucket, forecast_frames)
        except Exception as exc:
            print(f"WARN: forecast PNG rasterization failed: {exc!r}")
    elif phase1_dense and not r2_public_url:
        print("WARN: R2_PUBLIC_URL not set — skipping forecast PNG rasterization")



    # ---- phase2 (ICON-CH2 hourly — nahtlose CH1-Verlängerung) ----
    if only_phaseA:
        phase2 = prev.get("phase2") if isinstance(prev.get("phase2"), list) else []
        print(f"phase2 übernommen aus Cache: {len(phase2)} locations")
    else:
        print(f"fetch phase2 (ICON-CH2 hourly) in chunks of {chunk_p2} …")
        phase2 = chunk_fetch("phase2", p2, pts, chunk_p2, optional=True)
        if phase2 is None:
            print("phase2 failed — versuche Fallback auf bestehenden R2-Cache …")
            prev_phase2 = prev.get("phase2")
            if isinstance(prev_phase2, list) and prev_phase2:
                phase2 = prev_phase2
                print(f"  -> Fallback ok: {len(phase2)} locations aus bestehendem Cache")
            else:
                phase2 = []
                print("  -> kein Fallback verfügbar, phase2 bleibt leer")
        else:
            print(f"  -> {len(phase2)} locations")


    # ---- phaseC (Bias-Lookback) ----
    if only_phaseA:
        phaseC = prev.get("phaseC")
        print(f"phaseC übernommen aus Cache: {len(phaseC) if isinstance(phaseC, list) else 'none'} locations")
    else:
        print(f"fetch phaseC (bias lookback, optional) in chunks of {chunk_pc} …")
        phaseC = chunk_fetch("phaseC", pc, pts, chunk_pc, optional=True)
        print(f"  -> {len(phaseC) if phaseC is not None else 'skipped'} locations")

    # ---- phaseA (Symbolprognose) ----
    if skip_phaseA:
        phaseA = prev.get("phaseA") if isinstance(prev.get("phaseA"), list) else []
        print(f"phaseA übernommen aus Cache: {len(phaseA)} locations")
    else:
        print(f"fetch phaseA (multi-model 7d, optional) in chunks of {chunk_pa} …")
        phaseA = chunk_fetch("phaseA", pa, pts, chunk_pa, optional=True)
        if phaseA is None:
            print("phaseA failed — versuche Fallback auf bestehenden R2-Cache …")
            if isinstance(prev.get("phaseA"), list) and prev["phaseA"]:
                phaseA = prev["phaseA"]
                print(f"  -> Fallback ok: {len(phaseA)} locations aus bestehendem Cache")
            else:
                phaseA = []
                print("  -> kein Fallback verfügbar, phaseA bleibt leer")
        else:
            print(f"  -> {len(phaseA)} locations")

    payload = {
        "version": VERSION,
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "grid": {"points": [{"lat": la, "lon": lo} for la, lo in pts]},
        # Backwards-Compat für src/lib/radar.functions.ts
        "phase1": phase1,
        "phase2": phase2,
        # Neues 3-Phasen-Schema (analog Amriswil)
        "phaseB": phase1,
        "phaseA": phaseA,
        "phaseC": phaseC,
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/json",
        CacheControl="public, max-age=60, s-maxage=120",
    )
    print(f"uploaded {key} ({len(body)} bytes)")
    print("done")


if __name__ == "__main__":
    main()

