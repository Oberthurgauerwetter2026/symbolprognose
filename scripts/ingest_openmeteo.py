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

import json
import os
import sys
import time
from datetime import datetime, timezone

import boto3
import requests

VERSION = "oberthurgau-openmeteo-cache-v3-arome"
API = "https://api.open-meteo.com/v1/forecast"


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


def build_grid():
    min_lat = envf("BBOX_MIN_LAT", 47.30)
    max_lat = envf("BBOX_MAX_LAT", 47.85)
    min_lon = envf("BBOX_MIN_LON", 8.85)
    max_lon = envf("BBOX_MAX_LON", 9.85)
    n_lat = envi("GRID_LAT", 12)
    n_lon = envi("GRID_LON", 20)
    lats = [min_lat + (max_lat - min_lat) * i / (n_lat - 1) for i in range(n_lat)]
    lons = [min_lon + (max_lon - min_lon) * j / (n_lon - 1) for j in range(n_lon)]
    return [(la, lo) for la in lats for lo in lons]


def fetch(label: str, params: dict, optional: bool = False) -> list | None:
    # 429 = Minutenlimit -> volle Minute warten (API sagt explizit "try again in one minute").
    backoff_429 = [65, 65, 70, 90, 120]
    backoff_other = [3, 10, 30, 60, 120]
    last_err: Exception | None = None
    last_was_429 = False
    for attempt in range(5):
        last_was_429 = False
        try:
            r = requests.get(API, params=params, timeout=120)
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
        wait = backoff_429[attempt] if last_was_429 else backoff_other[attempt]
        print(f"WARN: {label} attempt {attempt + 1}/5 failed ({last_err}); retry in {wait}s")
        time.sleep(wait)
    msg = f"open-meteo {label} failed after 5 attempts: {last_err}"
    if optional:
        print(f"WARN: {msg} — skipping (optional)")
        return None
    sys.exit(msg)





def chunk_fetch(label: str, base_params: dict, pts: list, chunk_size: int, optional: bool = False) -> list | None:
    """Open-Meteo Bulk-Requests in Batches, um 502 vom Upstream-nginx zu vermeiden."""
    out: list = []
    total = len(pts)
    n_batches = (total + chunk_size - 1) // chunk_size
    try:
        batch_sleep = float(os.environ.get("BATCH_SLEEP_S", "6.0"))
    except ValueError:
        batch_sleep = 6.0
    for bi in range(n_batches):
        batch = pts[bi * chunk_size : (bi + 1) * chunk_size]
        params = dict(base_params)
        params["latitude"] = ",".join(f"{p[0]:.4f}" for p in batch)
        params["longitude"] = ",".join(f"{p[1]:.4f}" for p in batch)
        sub_label = f"{label} batch {bi + 1}/{n_batches} ({len(batch)} pts)"
        res = fetch(sub_label, params, optional=optional)
        if res is None:
            print(f"WARN: {label} skipped due to batch {bi + 1} failure (optional)")
            return None
        out.extend(res)
        print(f"  {sub_label} ok")
        if bi + 1 < n_batches:
            time.sleep(batch_sleep)
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


def main() -> None:
    skip_phaseA = _envflag("SKIP_PHASEA")
    only_phaseA = _envflag("ONLY_PHASEA")
    if skip_phaseA and only_phaseA:
        sys.exit("SKIP_PHASEA and ONLY_PHASEA are mutually exclusive")

    mode = "ONLY_PHASEA" if only_phaseA else ("SKIP_PHASEA" if skip_phaseA else "FULL")
    print(f"OPENMETEO INGEST START version={VERSION} mode={mode}")
    pts = build_grid()
    print(f"grid points: {len(pts)}")

    # phase1: ICON-CH1 minutely_15 (-12h … +33h) — Radar/Nowcast
    # + hourly.precipitation (-12h … +120h) als ICON-CH2-Deterministisch-Verlängerung
    p1 = {
        "minutely_15": "precipitation,snowfall",
        "past_minutely_15": 48,
        "forecast_minutely_15": 132,
        "hourly": "wind_speed_700hPa,wind_direction_700hPa,wind_speed_10m,wind_direction_10m,precipitation",
        "past_hours": 12,
        "forecast_hours": 120,
        "timezone": "UTC",
        "models": "meteoswiss_icon_ch1",
    }
    # phase2 entfernt — Worker nutzt nur ICON-CH1 (+32 h).
    # phaseA: Multi-Modell hourly+daily 7 d — Symbolprognose Hot-Path
    pa = {
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "precipitation_probability",
            "weathercode",
            "cloudcover",
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
        "models": "meteoswiss_icon_ch2,icon_d2,arpege_europe,meteofrance_arome_france_hd,ecmwf_ifs025,gfs_global",
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
    chunk_pa = envi("CHUNK_PHASEA", 20)
    chunk_pc = envi("CHUNK_PHASEC", 40)

    key = os.environ.get("OPENMETEO_OUT_KEY", "openmeteo/forecast.json")
    s3 = make_s3()
    bucket = env("R2_BUCKET")

    # Bestehenden Cache laden — wird je nach Mode für übersprungene Phasen
    # weiterverwendet, damit forecast.json immer ein vollständiges Set behält.
    prev = read_existing_payload(s3, bucket, key) or {}

    # ---- phase1 (Radar/Nowcast) ----
    if only_phaseA:
        phase1 = prev.get("phase1") or prev.get("phaseB") or []
        print(f"phase1 übernommen aus Cache: {len(phase1)} locations")
    else:
        print(f"fetch phase1 (ICON-CH1 minutely_15) in chunks of {chunk_p1} …")
        phase1 = chunk_fetch("phase1", p1, pts, chunk_p1)
        print(f"  -> {len(phase1)} locations")

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
        "phase2": [],
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

