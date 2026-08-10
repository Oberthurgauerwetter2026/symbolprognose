#!/usr/bin/env python3
"""
Blitzortung.org → Cloudflare R2 ingest.

Verbindet sich zum öffentlichen Blitzortung-Websocket, sammelt Strikes
für ein paar Sekunden, filtert auf den Alpen-Bounding-Box (Lat 44–49,
Lon 5–12) und schreibt `lightning/latest.json` nach R2.

Best-effort: Wenn der Websocket nicht erreichbar ist oder das Protokoll
sich ändert, wird eine leere Datei geschrieben, damit das UI trotzdem
sauber weiterläuft. Ein `debug`-Feld protokolliert, was passiert ist.

Blitzortung ist ein Community-Projekt. Attribution im UI ist Pflicht.

ENV (required): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
                R2_BUCKET, R2_PUBLIC_URL
ENV (optional): BO_WINDOW_MIN (default 15), BO_LISTEN_S (default 280)
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
ARCHIVE_MIN = int(os.environ.get("BO_ARCHIVE_MIN", "360"))
LISTEN_S = int(os.environ.get("BO_LISTEN_S", "280"))

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


async def _collect_strikes(debug: dict) -> list[dict]:
    try:
        import websockets  # type: ignore
    except ImportError:
        print("websockets lib fehlt — überspringe Live-Fetch", file=sys.stderr)
        debug["websocketsMissing"] = True
        return []

    strikes: list[dict] = []
    seen: set[tuple[float, float, str]] = set()
    deadline = time.monotonic() + LISTEN_S
    debug["rawMessages"] = 0
    debug["decodedOk"] = 0
    debug["strikesGlobal"] = 0
    debug["endpointsTried"] = []
    debug["endpointOk"] = None

    for endpoint in BO_ENDPOINTS:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        debug["endpointsTried"].append(endpoint)
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
                    debug["rawMessages"] += 1
                    try:
                        text = _decode(raw if isinstance(raw, str) else raw.decode("utf-8", "ignore"))
                        obj = json.loads(text)
                    except Exception:
                        continue
                    debug["decodedOk"] += 1
                    lat = obj.get("lat")
                    lon = obj.get("lon")
                    ts_ns = obj.get("time")
                    if lat is None or lon is None or ts_ns is None:
                        continue
                    debug["strikesGlobal"] += 1
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
                debug["endpointOk"] = endpoint
                break
        except Exception as e:
            msg = f"BO endpoint {endpoint} fail: {e}"
            print(msg, file=sys.stderr)
            debug.setdefault("endpointErrors", []).append(msg)
            continue

    return strikes


def _prune(strikes: list[dict], minutes: int, cap: int) -> list[dict]:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(minutes=minutes)
    out = []
    for s in strikes:
        try:
            t = datetime.fromisoformat(s["t"].replace("Z", "+00:00"))
        except Exception:
            continue
        if t >= cutoff:
            out.append(s)
    out.sort(key=lambda s: s["t"])
    return out[-cap:]


def _prune_window(strikes: list[dict]) -> list[dict]:
    return _prune(strikes, WINDOW_MIN, 5000)


def _merge(old: list[dict], new: list[dict]) -> list[dict]:
    """Alte und neue Blitze zusammenführen, Duplikate über t/lat/lon entfernen."""
    seen: set[tuple] = set()
    out: list[dict] = []
    for s in [*old, *new]:
        try:
            key = (s["t"], round(float(s["lat"]), 4), round(float(s["lon"]), 4))
        except Exception:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _make_s3():
    account_id = os.environ["R2_ACCOUNT_ID"]
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=BotoConfig(retries={"max_attempts": 5, "mode": "standard"}),
    )


def _fetch_archive_s3(s3) -> list[dict]:
    """Bestehendes Archiv direkt aus dem Bucket laden.

    Fehlende Datei → leeres Archiv. Jeder andere Fehler wird geworfen, damit
    das Archiv nicht stillschweigend überschrieben wird.
    """
    try:
        res = s3.get_object(Bucket=os.environ["R2_BUCKET"], Key="lightning/recent.json")
    except Exception as e:
        code = getattr(e, "response", {}).get("Error", {}).get("Code") if hasattr(e, "response") else None
        if code in ("NoSuchKey", "404", "NotFound"):
            return []
        raise
    data = json.loads(res["Body"].read().decode("utf-8"))
    got = data.get("strikes")
    return got if isinstance(got, list) else []


def main() -> int:
    debug: dict = {"listenSeconds": LISTEN_S, "windowMinutes": WINDOW_MIN}
    s3 = _make_s3()

    # Archiv VOR dem Sammeln lesen — schlägt das fehl, wird `recent.json`
    # nicht angetastet.
    archive_ok = True
    old_archive: list[dict] = []
    try:
        old_archive = _fetch_archive_s3(s3)
        debug["archiveFetched"] = len(old_archive)
    except Exception as e:
        archive_ok = False
        debug["archiveFetchError"] = str(e)
        print(f"Archiv-Lesen fehlgeschlagen: {e}", file=sys.stderr)

    try:
        strikes = asyncio.run(_collect_strikes(debug))
    except Exception as e:
        debug["fatal"] = str(e)
        strikes = []
    latest = _prune_window(strikes)
    debug["strikesInBBox"] = len(latest)

    kept_old = _prune(old_archive, ARCHIVE_MIN, 60000)
    archive = _prune(_merge(old_archive, strikes), ARCHIVE_MIN, 60000)
    debug["archiveStrikes"] = len(archive)
    debug["archiveMinutes"] = ARCHIVE_MIN
    if archive:
        debug["archiveOldest"] = archive[0]["t"]
        debug["archiveNewest"] = archive[-1]["t"]

    # Plausibilität: das neue Archiv muss mindestens die noch gültigen alten
    # Blitze enthalten, sonst wäre es ein Datenverlust.
    archive_safe = archive_ok and len(archive) >= len(kept_old)
    if not archive_safe:
        debug["archiveWriteSkipped"] = True

    now_iso = datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _payload(items: list[dict], window: int) -> bytes:
        return json.dumps(
            {
                "generatedAt": now_iso,
                "bbox": BBOX,
                "strikes": items,
                "windowMinutes": window,
                "attribution": "Blitze: Blitzortung.org",
                "debug": debug,
            },
            separators=(",", ":"),
        ).encode("utf-8")

    s3.put_object(
        Bucket=os.environ["R2_BUCKET"],
        Key="lightning/latest.json",
        Body=_payload(latest, WINDOW_MIN),
        ContentType="application/json",
        CacheControl="public, max-age=20",
    )
    if archive_safe:
        s3.put_object(
            Bucket=os.environ["R2_BUCKET"],
            Key="lightning/recent.json",
            Body=_payload(archive, ARCHIVE_MIN),
            ContentType="application/json",
            CacheControl="public, max-age=20",
        )
    print(
        f"uploaded {len(latest)} strikes (window={WINDOW_MIN} min), "
        f"archive {len(archive)} strikes ({ARCHIVE_MIN} min, "
        f"written={archive_safe}) debug={debug}"
    )
    return 0 if archive_safe else 1



if __name__ == "__main__":
    sys.exit(main())

