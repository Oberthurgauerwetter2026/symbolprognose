#!/usr/bin/env python3
"""
Blitzortung.org -> Cloudflare R2 ingest.

Holt die letzten Blitzeinschläge von
  https://data.blitzortung.org/Data/Protected/last_strikes.php
mit HTTP Basic Auth (BLITZORTUNG_USERNAME / BLITZORTUNG_PASSWORD),
filtert auf die Region Oberthurgau (etwas weitere BBox) und die
letzten 30 Minuten und legt das Ergebnis als
  lightning/strikes.json
in R2 ab.

Benötigte ENV-Variablen:
  BLITZORTUNG_USERNAME, BLITZORTUNG_PASSWORD
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_URL
"""

from __future__ import annotations

import gzip
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import boto3
import requests

LIGHTNING_INGEST_VERSION = "v1"

# Etwas grösser als Radar-BBox, damit auch nahe Gewitter aussen sichtbar bleiben.
BBOX = {
    "minLat": 47.0,
    "maxLat": 48.0,
    "minLon": 8.5,
    "maxLon": 10.0,
}
WINDOW_MIN = 30  # Minuten

STRIKES_URL = "https://data.blitzortung.org/Data/Protected/last_strikes.php"


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


def fetch_strikes() -> list[dict]:
    user = env("BLITZORTUNG_USERNAME")
    pw = env("BLITZORTUNG_PASSWORD")
    print(f"GET {STRIKES_URL} as {user}")
    r = requests.get(
        STRIKES_URL,
        auth=(user, pw),
        timeout=30,
        headers={"Accept-Encoding": "gzip", "User-Agent": "symbolprognose-ingest/1.0"},
    )
    if r.status_code != 200:
        sys.exit(f"blitzortung HTTP {r.status_code}: {r.text[:200]}")

    body = r.content
    # Antwort kann gzip-komprimiert sein, auch wenn requests es schon entpackt hat.
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)

    text = body.decode("utf-8", errors="replace")
    out: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        out.append(obj)
    print(f"received {len(out)} raw strokes")
    return out


def filter_strikes(raw: list[dict]) -> list[dict]:
    """Behalte nur Einschläge in BBox und letzten WINDOW_MIN Minuten."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=WINDOW_MIN)
    keep: list[dict] = []
    for obj in raw:
        try:
            lat = float(obj["lat"])
            lon = float(obj["lon"])
        except (KeyError, ValueError, TypeError):
            continue
        if not (BBOX["minLat"] <= lat <= BBOX["maxLat"]):
            continue
        if not (BBOX["minLon"] <= lon <= BBOX["maxLon"]):
            continue
        # `time` ist Nanosekunden seit Epoch.
        try:
            t_ns = int(obj["time"])
        except (KeyError, ValueError, TypeError):
            continue
        t = datetime.fromtimestamp(t_ns / 1e9, tz=timezone.utc)
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
    raw = fetch_strikes()
    strikes = filter_strikes(raw)
    print(f"kept {len(strikes)} strokes in region (last {WINDOW_MIN} min)")
    payload = {
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "windowMinutes": WINDOW_MIN,
        "bbox": BBOX,
        "strikes": strikes,
    }
    upload(s3, payload)
    print("done")


if __name__ == "__main__":
    main()
