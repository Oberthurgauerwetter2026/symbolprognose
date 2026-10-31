"""Live-Stationsmessungen (2-m-Temperatur, Taupunkt) für die Radar-Phase.

Quellen: MeteoSchweiz SMN `t_now` (10 min) und die eigenen Weather-Hub-
Stationen. Ergebnis pro Zeitpunkt: Liste (lat, lon, alt, T, Td). Fehlt eine
Quelle, wird sie still übersprungen — die Phase fällt dann aufs Modell zurück.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import requests

MCH = [
    ("GUT", 47.6017, 9.2794, 440), ("ARH", 47.4836, 9.5669, 398),
    ("BIZ", 47.5088, 9.2668, 507), ("STG", 47.4255, 9.3985, 776),
    ("SAE", 47.2494, 9.3435, 2501), ("TAE", 47.4799, 8.9049, 539),
    ("HAI", 47.6512, 9.0239, 719), ("STK", 47.6686, 8.9814, 397),
    ("SHA", 47.6898, 8.6201, 438), ("HOE", 47.3709, 8.9416, 1133),
    ("EBK", 47.2734, 9.1085, 623), ("OBR", 47.3766, 9.6127, 409),
]
HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co"
HUB_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6"
    "ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU"
)
OWN = [
    ("69a6f29c-6603-43fe-90a7-c92796183531", 47.5531, 9.3204, 437),
    ("ba4b631b-cf76-4b79-8f0d-4f9a334e02a4", 47.578, 9.3504, 405),
    ("6a6d8137-9ce5-4292-a2a8-1c89c0d70be7", 47.492, 9.4524, 400),
    ("03528d1a-939b-4410-9155-9f44c1ea8a8d", 47.6263, 9.2474, 405),
    ("08a9336c-79c7-4b31-9fad-8db3feb2ad84", 47.5326, 9.3815, 420),
    ("49335a93-c655-4459-a1be-45a7cedad550", 47.5592, 9.1733, 520),
    ("2f0d7491-788a-494c-a03c-0b4fc96460e5", 47.5076, 9.3806, 440),
]
MAX_GAP = timedelta(minutes=20)

_SERIES: list | None = None


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _load_mch() -> list:
    out = []
    for sid, la, lo, alt in MCH:
        s = sid.lower()
        try:
            r = requests.get(
                f"https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{s}/ogd-smn_{s}_t_now.csv", timeout=20,
            )
            r.raise_for_status()
            lines = r.text.strip().splitlines()
            head = lines[0].split(";")
            it, iT, iD = head.index("reference_timestamp"), head.index("tre200s0"), head.index("tde200s0")
            ser = []
            for ln in lines[1:]:
                c = ln.split(";")
                ts = datetime.strptime(c[it], "%d.%m.%Y %H:%M").replace(tzinfo=timezone.utc)
                ser.append((ts, _f(c[iT]), _f(c[iD])))
            out.append((la, lo, alt, ser))
        except Exception as exc:  # noqa: BLE001
            print(f"obs: MCH {sid} unavailable ({exc!r})", flush=True)
    return out


def _load_own() -> list:
    out = []
    since = (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat()
    for sid, la, lo, alt in OWN:
        try:
            r = requests.get(
                f"{HUB_URL}/rest/v1/readings",
                params={"select": "measured_at,temperature,dew_point", "station_id": f"eq.{sid}",
                        "measured_at": f"gt.{since}", "order": "measured_at.asc", "limit": "1000"},
                headers={"apikey": HUB_KEY}, timeout=20,
            )
            r.raise_for_status()
            ser = [(datetime.fromisoformat(x["measured_at"]), _f(x.get("temperature")), _f(x.get("dew_point")))
                   for x in r.json()]
            out.append((la, lo, alt, ser))
        except Exception as exc:  # noqa: BLE001
            print(f"obs: own station {sid[:8]} unavailable ({exc!r})", flush=True)
    return out


def observations_at(ts: datetime) -> list:
    """(lat, lon, alt, T, Td) je Station, nächster Messwert ≤ 20 min von ts."""
    global _SERIES
    if _SERIES is None:
        _SERIES = _load_mch() + _load_own()
        print(f"obs: {len(_SERIES)} Stationen geladen", flush=True)
    res = []
    for la, lo, alt, ser in _SERIES:
        best = min(ser, key=lambda x: abs(x[0] - ts), default=None)
        if best is None or abs(best[0] - ts) > MAX_GAP or best[1] is None:
            continue
        # Plausibilität: Taupunkt nie über Temperatur.
        td = best[2] if best[2] is not None and best[2] <= best[1] + 0.1 else None
        res.append((la, lo, alt, best[1], td))
    return res
