#!/usr/bin/env python3
"""
Open-Meteo (ICON-CH1 minutely_15 + ICON-CH2 hourly) -> Cloudflare R2 cache.

Holt die zwei Multi-Location-Forecast-Requests, die das Frontend sonst pro
Worker-Request selbst gemacht hätte, und legt das rohe JSON unter
`openmeteo/forecast.json` in R2 ab. Der Worker liest danach nur noch R2 →
keine Open-Meteo-Calls vom Worker mehr → keine 429-Limits.

ENV (required):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
ENV (optional):
  OPENMETEO_OUT_KEY   default "openmeteo/forecast.json"
  BBOX_MIN_LAT/MAX_LAT/MIN_LON/MAX_LON   default = Oberthurgau
  GRID_LAT (default 9), GRID_LON (default 14)
"""
from __future__ import annotations

import io
import json
import os
import sys
from datetime import datetime, timezone

import boto3
import requests

VERSION = "openmeteo-cache-v1"
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
    min_lat = envf("BBOX_MIN_LAT", 47.38)
    max_lat = envf("BBOX_MAX_LAT", 47.72)
    min_lon = envf("BBOX_MIN_LON", 9.00)
    max_lon = envf("BBOX_MAX_LON", 9.62)
    n_lat = envi("GRID_LAT", 9)
    n_lon = envi("GRID_LON", 14)
    lats = [min_lat + (max_lat - min_lat) * i / (n_lat - 1) for i in range(n_lat)]
    lons = [min_lon + (max_lon - min_lon) * j / (n_lon - 1) for j in range(n_lon)]
    pts = [(la, lo) for la in lats for lo in lons]
    return pts


def fetch(params: dict) -> list:
    r = requests.get(API, params=params, timeout=45)
    if not r.ok:
        sys.exit(f"open-meteo HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    return data if isinstance(data, list) else [data]


def main() -> None:
    print(f"OPENMETEO INGEST START version={VERSION}")
    pts = build_grid()
    lat_str = ",".join(f"{p[0]:.4f}" for p in pts)
    lon_str = ",".join(f"{p[1]:.4f}" for p in pts)
    print(f"grid points: {len(pts)}")

    # Phase 1: ICON-CH1 minutely_15 (-12 h … +33 h)
    p1 = {
        "latitude": lat_str,
        "longitude": lon_str,
        "minutely_15": "precipitation",
        "past_minutely_15": 48,
        "forecast_minutely_15": 132,
        "timezone": "UTC",
        "models": "meteoswiss_icon_ch1",
    }
    # Phase 2: ICON-CH2 hourly (+0 … +6 d)
    p2 = {
        "latitude": lat_str,
        "longitude": lon_str,
        "hourly": "precipitation",
        "forecast_days": 6,
        "timezone": "UTC",
        "models": "meteoswiss_icon_ch2",
    }

    print("fetch phase1 (ICON-CH1) …")
    phase1 = fetch(p1)
    print(f"  -> {len(phase1)} locations")
    print("fetch phase2 (ICON-CH2) …")
    phase2 = fetch(p2)
    print(f"  -> {len(phase2)} locations")

    payload = {
        "version": VERSION,
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "phase1": phase1,
        "phase2": phase2,
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
