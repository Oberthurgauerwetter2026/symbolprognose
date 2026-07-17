#!/usr/bin/env python3
"""
Blitzortung.org → Cloudflare R2 ingest.

Verbindet sich zum öffentlichen Blitzortung-Websocket, sammelt Strikes
für ein paar Sekunden, filtert auf den Alpen-Bounding-Box (Lat 44–49,
Lon 5–12) und schreibt `lightning/latest.json` nach R2.

Best-effort: Wenn der Websocket nicht erreichbar ist oder das Protokoll
sich ändert, wird eine leere Datei geschrieben, damit das UI trotzdem
sauber weiterläuft.

Blitzortung ist ein Community-Projekt. Attribution im UI ist Pflicht.

ENV (required): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
                R2_BUCKET, R2_PUBLIC_URL
ENV (optional): BO_WINDOW_MIN (default 15), BO_LISTEN_S (default 90)
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import boto3
from botocore.config import Config as BotoConfig

BBOX = {"minLat": 44.0, "maxLat": 49.0, "minLon": 5.0, "maxLon": 12.0}
WINDOW_MIN = int(os.environ.get("BO_WINDOW_MIN", "15"))
LISTEN_S = int(os.environ.get("BO_LISTEN_S", "90"))

BO_ENDPOINTS = [
    "wss://ws1.blitzortung.org",
    "wss://ws7.blitzortung.org",
    "wss://ws8.blitzortung.org",
]


def _decode(text: str) -> str:
    """LZW-ähnliche Dekompression, wie im Blitzortung-Web-Client genutzt."""
    e: dict[int, str] = {}
    d = list(text)
    if not d:
        return ""
    c = d[0]
    f = c
    result = [c]
    code = 256
    for i in range(1, len(d)):
        a = ord(d[i])
        b = e[a] if a in e else (d[i] if a < 256 else f + c)
        result.append(b)
        c = b[0]
        e[code] = f + c
        code += 1
        f = b
    return "".join(result)


async def _collect_strikes() -> list[dict]:
    try:
        import websockets  # type: ignore
    except ImportError:
        print("websockets lib fehlt — überspringe Live-Fetch", file=sys.stderr)
        return []

    strikes: list[dict] = []
    seen: set[tuple[float, float, str]] = set()
    deadline = time.monotonic() + LISTEN_S

    for endpoint in BO_ENDPOINTS:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            async with websockets.connect(endpoint, open_timeout=8, ping_timeout=15) as ws:
                await ws.send('{"a": 111}')
                while True:
                    left = deadline - time.monotonic()
                    if left <= 0:
                        break
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=min(left, 20))
                    except asyncio.TimeoutError:
                        break
                    try:
                        text = _decode(raw if isinstance(raw, str) else raw.decode("utf-8", "ignore"))
                        obj = json.loads(text)
                    except Exception:
                        continue
                    lat = obj.get("lat")
                    lon = obj.get("lon")
                    ts_ns = obj.get("time")
                    if lat is None or lon is None or ts_ns is None:
                        continue
                    if not (BBOX["minLat"] <= lat <= BBOX["maxLat"] and BBOX["minLon"] <= lon <= BBOX["maxLon"]):
                        continue
                    try:
                        t_iso = datetime.fromtimestamp(int(ts_ns) / 1e9, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
                    except Exception:
                        continue
                    key = (round(lat, 4), round(lon, 4), t_iso)
                    if key in seen:
                        continue
                    seen.add(key)
                    strikes.append({"t": t_iso, "lat": round(lat, 4), "lon": round(lon, 4)})
                # ein erfolgreicher Endpoint reicht
                break
        except Exception as e:
            print(f"BO endpoint {endpoint} fail: {e}", file=sys.stderr)
            continue

    return strikes


def _prune_window(strikes: list[dict]) -> list[dict]:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(minutes=WINDOW_MIN)
    out = []
    for s in strikes:
        try:
            t = datetime.fromisoformat(s["t"].replace("Z", "+00:00"))
        except Exception:
            continue
        if t >= cutoff:
            out.append(s)
    out.sort(key=lambda s: s["t"])
    return out[-5000:]


def main() -> int:
    strikes = asyncio.run(_collect_strikes())
    strikes = _prune_window(strikes)
    payload = {
        "generatedAt": datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "bbox": BBOX,
        "strikes": strikes,
        "attribution": "Blitze: Blitzortung.org",
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    account_id = os.environ["R2_ACCOUNT_ID"]
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=BotoConfig(retries={"max_attempts": 5, "mode": "standard"}),
    )
    s3.put_object(
        Bucket=os.environ["R2_BUCKET"],
        Key="lightning/latest.json",
        Body=body,
        ContentType="application/json",
        CacheControl="public, max-age=20",
    )
    print(f"uploaded {len(strikes)} strikes (window={WINDOW_MIN} min)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
