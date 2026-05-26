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

VERSION = "oberthurgau-openmeteo-cache-v2"
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
    backoffs = [3, 10, 30, 60, 120]
    last_err: Exception | None = None
    for attempt in range(5):
        try:
            r = requests.get(API, params=params, timeout=120)
            if not r.ok:
                # 4xx: nicht retrybar — sofort behandeln.
                if 400 <= r.status_code < 500:
                    msg = f"open-meteo HTTP {r.status_code} ({label}): {r.text[:300]}"
                    if optional:
                        print(f"WARN: {msg} — skipping (optional)")
                        return None
                    sys.exit(msg)
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
        wait = backoffs[attempt]
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
    for bi in range(n_batches):
        batch = pts[bi * chunk_size : (bi + 1) * chunk_size]
        params = dict(base_params)
        params["latitude"] = ",".join(f"{p[0]:.4f}" for p in batch)
        params["longitude"] = ",".join(f"{p[1]:.4f}" for p in batch)
        sub_label = f"{label} batch {bi + 1}/{n_batches} ({len(batch)} pts)"
        res = fetch(sub_label, params, optional=optional)
        if res is None:
            # nur möglich wenn optional=True und alle Retries scheitern -> ganze Phase überspringen
            print(f"WARN: {label} skipped due to batch {bi + 1} failure (optional)")
            return None
        out.extend(res)
        print(f"  {sub_label} ok")
    return out




def main() -> None:
    print(f"OPENMETEO INGEST START version={VERSION}")
    pts = build_grid()
    print(f"grid points: {len(pts)}")

    # phase1: ICON-CH1 minutely_15 (-12h … +33h) — Radar/Nowcast
    p1 = {
        "minutely_15": "precipitation",
        "past_minutely_15": 48,
        "forecast_minutely_15": 132,
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
        "models": "meteoswiss_icon_ch2,icon_d2,arpege_europe,ecmwf_ifs025,gfs_global",
    }
    # phaseC: Bias-Lookback (-7 d … +1 d) best_match
    pc = {
        "hourly": "temperature_2m,wind_speed_10m,precipitation",
        "past_days": 7,
        "forecast_days": 1,
        "timezone": "Europe/Zurich",
        "models": "best_match",
    }

    # Chunk-Grössen — kleiner = weniger 502, mehr Requests
    chunk_p1 = envi("CHUNK_PHASE1", 60)
    chunk_pa = envi("CHUNK_PHASEA", 40)
    chunk_pc = envi("CHUNK_PHASEC", 80)

    print(f"fetch phase1 (ICON-CH1 minutely_15) in chunks of {chunk_p1} …")
    phase1 = chunk_fetch("phase1", p1, pts, chunk_p1)
    print(f"  -> {len(phase1)} locations")
    print(f"fetch phaseA (multi-model 7d) in chunks of {chunk_pa} …")
    phaseA = chunk_fetch("phaseA", pa, pts, chunk_pa)
    print(f"  -> {len(phaseA)} locations")
    print(f"fetch phaseC (bias lookback, optional) in chunks of {chunk_pc} …")
    phaseC = chunk_fetch("phaseC", pc, pts, chunk_pc, optional=True)
    print(f"  -> {len(phaseC) if phaseC is not None else 'skipped'} locations")


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

    key = os.environ.get("OPENMETEO_OUT_KEY", "openmeteo/forecast.json")
    s3 = make_s3()
    s3.put_object(
        Bucket=env("R2_BUCKET"),
        Key=key,
        Body=body,
        ContentType="application/json",
        CacheControl="public, max-age=60, s-maxage=120",
    )
    print(f"uploaded {key} ({len(body)} bytes)")
    print("done")


if __name__ == "__main__":
    main()

