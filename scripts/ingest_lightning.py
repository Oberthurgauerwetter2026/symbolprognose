#!/usr/bin/env python3
"""
KNMI Lightning (Dataset lightning-detection-nl23) -> Cloudflare R2 ingest.

Holt die letzte HDF5-Datei aus dem KNMI Open Data Platform, parst die
enthaltenen Blitz-Discharges, filtert auf die Region Oberthurgau
(etwas weitere BBox) und die letzten WINDOW_MIN Minuten und legt das
Ergebnis als `lightning/strikes.json` in R2 ab.

Datenquelle: KNMI / Météorage (CC BY 4.0).

ENV:
  KNMI_API_KEY
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_URL
"""

from __future__ import annotations

import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import boto3
import h5py
import numpy as np
import requests

LIGHTNING_INGEST_VERSION = "knmi-v1"

DATASET = "lightning-detection-nl23"
VERSION = "1.0"
KNMI_BASE = "https://api.dataplatform.knmi.nl/open-data/v1"

# Etwas grösser als Radar-BBox, damit auch nahe Gewitter aussen sichtbar bleiben.
BBOX = {
    "minLat": 47.0,
    "maxLat": 48.0,
    "minLon": 8.5,
    "maxLon": 10.0,
}
WINDOW_MIN = 30


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


def knmi_headers() -> dict:
    return {"Authorization": env("KNMI_API_KEY")}


def list_latest_files(n: int = 5) -> list[dict]:
    url = f"{KNMI_BASE}/datasets/{DATASET}/versions/{VERSION}/files"
    params = {"maxKeys": n, "orderBy": "created", "sorting": "desc"}
    r = requests.get(url, headers=knmi_headers(), params=params, timeout=30)
    if r.status_code != 200:
        sys.exit(f"KNMI list HTTP {r.status_code}: {r.text[:300]}")
    files = r.json().get("files", [])
    if not files:
        sys.exit("KNMI list: no files returned")
    print(f"latest {len(files)} files:")
    for f in files:
        print(f"  - {f.get('filename')} created={f.get('created')}")
    return files


def download_file(filename: str) -> bytes:
    url = f"{KNMI_BASE}/datasets/{DATASET}/versions/{VERSION}/files/{filename}/url"
    r = requests.get(url, headers=knmi_headers(), timeout=30)
    if r.status_code != 200:
        sys.exit(f"KNMI url HTTP {r.status_code}: {r.text[:300]}")
    temp_url = r.json().get("temporaryDownloadUrl")
    if not temp_url:
        sys.exit(f"KNMI url: no temporaryDownloadUrl in {r.text[:300]}")
    dl = requests.get(temp_url, timeout=60)
    if dl.status_code != 200:
        sys.exit(f"KNMI download HTTP {dl.status_code}")
    return dl.content


def _flatten_strikes(h5: h5py.File) -> list[dict]:
    """KNMI lightning HDF5 hat typischerweise eine Gruppe `discharge1`
    mit Datasets `latitude`, `longitude`, `time` (Sekunden seit Epoch
    oder ISO) und ggf. mehrere `dischargeN`-Gruppen pro Datei.

    Wir laufen defensiv über alle Gruppen, die `latitude`/`longitude`
    enthalten.
    """
    out: list[dict] = []
    keys = list(h5.keys())
    print(f"HDF5 root groups: {keys}")

    for gname in keys:
        node = h5[gname]
        if not isinstance(node, h5py.Group):
            continue
        sub = list(node.keys())
        has_lat = any(k.lower() in ("latitude", "lat") for k in sub)
        has_lon = any(k.lower() in ("longitude", "lon") for k in sub)
        if not (has_lat and has_lon):
            continue
        print(f"  group {gname} datasets: {sub}")
        lat_key = next(k for k in sub if k.lower() in ("latitude", "lat"))
        lon_key = next(k for k in sub if k.lower() in ("longitude", "lon"))
        lats = np.array(node[lat_key]).reshape(-1)
        lons = np.array(node[lon_key]).reshape(-1)
        # Zeit: kann "time", "timestamp", "datetime" heissen, Sekunden ab Epoch
        # oder ISO-Bytes.
        time_key = None
        for k in sub:
            if k.lower() in ("time", "timestamp", "datetime", "datetime_flash"):
                time_key = k
                break
        if time_key is None:
            print(f"    no time dataset in {gname}, skip")
            continue
        times_raw = np.array(node[time_key]).reshape(-1)
        # Attribut "units" auswerten falls vorhanden (z.B. "seconds since 1970-01-01")
        time_units = node[time_key].attrs.get("units", b"")
        if isinstance(time_units, bytes):
            time_units = time_units.decode("utf-8", "replace")

        for i in range(len(lats)):
            try:
                lat = float(lats[i])
                lon = float(lons[i])
            except (TypeError, ValueError):
                continue
            raw = times_raw[i]
            t = _parse_time(raw, time_units)
            if t is None:
                continue
            out.append({"lat": lat, "lon": lon, "t": t})
    return out


def _parse_time(raw, units: str) -> datetime | None:
    # Bytes / String -> ISO parsen
    if isinstance(raw, (bytes, bytearray)):
        try:
            s = raw.decode("utf-8", "replace").strip()
            return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        except Exception:
            return None
    # Zahl: je nach Units interpretieren
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return None
    u = units.lower()
    # KNMI verwendet meist "seconds since 2000-01-01 00:00:00.0 +0000"
    if "since" in u:
        try:
            anchor_str = u.split("since", 1)[1].strip()
            # Pakete wie cftime wären sauberer, aber wir parsen einfach.
            anchor_str = anchor_str.replace("+0000", "+00:00")
            # Cut microseconds tail like ".0"
            anchor = datetime.fromisoformat(anchor_str)
            if anchor.tzinfo is None:
                anchor = anchor.replace(tzinfo=timezone.utc)
            if u.startswith("seconds"):
                return anchor + timedelta(seconds=val)
            if u.startswith("milliseconds"):
                return anchor + timedelta(milliseconds=val)
            if u.startswith("minutes"):
                return anchor + timedelta(minutes=val)
            if u.startswith("hours"):
                return anchor + timedelta(hours=val)
            if u.startswith("days"):
                return anchor + timedelta(days=val)
        except Exception:
            pass
    # Fallback: heuristisch
    # > 1e12 -> ms epoch, > 1e9 -> s epoch
    if val > 1e12:
        return datetime.fromtimestamp(val / 1000, tz=timezone.utc)
    if val > 1e9:
        return datetime.fromtimestamp(val, tz=timezone.utc)
    return None


def filter_region(strikes: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=WINDOW_MIN)
    keep: list[dict] = []
    for s in strikes:
        lat, lon, t = s["lat"], s["lon"], s["t"]
        if not (BBOX["minLat"] <= lat <= BBOX["maxLat"]):
            continue
        if not (BBOX["minLon"] <= lon <= BBOX["maxLon"]):
            continue
        if t < cutoff:
            continue
        keep.append(
            {
                "t": t.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "lat": round(lat, 5),
                "lon": round(lon, 5),
            }
        )
    keep.sort(key=lambda s: s["t"])
    return keep


def upload(s3, payload: dict) -> None:
    bucket = env("R2_BUCKET")
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    s3.put_object(
        Bucket=bucket,
        Key="lightning/strikes.json",
        Body=body,
        ContentType="application/json",
        CacheControl="public, max-age=20, s-maxage=20",
    )
    print(f"uploaded lightning/strikes.json ({len(body)} bytes)")


def main() -> None:
    print(f"LIGHTNING INGEST START version={LIGHTNING_INGEST_VERSION}")
    s3 = make_s3()
    files = list_latest_files(n=5)
    # Wir mergen die letzten paar Dateien, falls eine Datei nur wenige Minuten abdeckt.
    all_strikes: list[dict] = []
    for f in files:
        name = f["filename"]
        print(f"download {name}")
        try:
            blob = download_file(name)
            with h5py.File(io.BytesIO(blob), "r") as h5:
                all_strikes.extend(_flatten_strikes(h5))
        except Exception as e:
            print(f"  error on {name}: {e}")
            continue
    print(f"parsed {len(all_strikes)} raw strikes")
    strikes = filter_region(all_strikes)
    print(f"kept {len(strikes)} strikes in region (last {WINDOW_MIN} min)")
    payload = {
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "windowMinutes": WINDOW_MIN,
        "bbox": BBOX,
        "source": "KNMI / Météorage",
        "strikes": strikes,
    }
    upload(s3, payload)
    print("done")


if __name__ == "__main__":
    main()
