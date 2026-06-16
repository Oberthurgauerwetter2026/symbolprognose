#!/usr/bin/env python3
"""
MeteoSwiss `ch.meteoschweiz.ogd-local-forecasting` -> R2 Cache.

Primärquelle der Symbol- und Lokalprognose im Frontend. Pro Spot
(SPOTS in src/data/spots.ts) wird der jüngste STAC-Item-Lauf nach den
relevanten Parametern gefiltert (hourly + daily) und zu einem JSON
analog dem Open-Meteo `ForecastResponse`-Schema zusammengefasst.

R2-Output:  mch/local_forecast.json
ENV:        R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import boto3
import requests

VERSION = "mch-local-forecast-v1"
STAC_ITEMS = "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items"
# Per Spot lokaler UTC-Offset (CH = Europe/Zurich → +1h Winter / +2h Sommer).
# Wir setzen den Wert dynamisch beim Build anhand des aktuellen Datums.
ZURICH_TZ_NAME = "Europe/Zurich"


# Spot-Liste muss synchron zu src/data/spots.ts bleiben.
SPOTS = [
    {"id": "horn",            "name": "Horn",                "lat": 47.4929, "lon": 9.4610, "mch": 932600},
    {"id": "amriswil",        "name": "Amriswil",            "lat": 47.5428, "lon": 9.2871, "mch": 858000},
    {"id": "bischofszell",    "name": "Bischofszell",        "lat": 47.4957, "lon": 9.2158, "mch": 922301},
    {"id": "muensterlingen",  "name": "Münsterlingen",       "lat": 47.6254, "lon": 9.2356, "mch": 859601},
    {"id": "romanshorn",      "name": "Romanshorn",          "lat": 47.5636, "lon": 9.3569, "mch": 859000},
    {"id": "hauptwil",        "name": "Hauptwil-Gottshaus",  "lat": 47.4896, "lon": 9.2801, "mch": 922500},
    {"id": "langrickenbach",  "name": "Langrickenbach",      "lat": 47.5946, "lon": 9.2409, "mch": 858508},
    {"id": "egnach",          "name": "Egnach",              "lat": 47.5288, "lon": 9.3652, "mch": 931500},
]

# Parameter, die wir holen. `granularity` ist H (stündlich) oder D (täglich).
HOURLY_PARAMS = {
    "temperature_2m":            "tre200h0",
    "precipitation":             "rre150h0",
    "precipitation_probability": "rp0003i0",   # 3h-Wahrscheinlichkeit, wird auf jede Stunde repliziert
    "windspeed_10m":             "fu3010h0",
    "windgusts_10m":             "fu3010h1",
    "winddirection_10m":         "dkl010h0",
    "weathercode_mch":           "jww003i0",   # MCH-Icon-Nummer, wird zu WMO gemappt
    "sunshine_minutes":          "sre000h0",   # min → s
    "cloud_cover_low":           "nprolohs",
    "cloud_cover_mid":           "npromths",
    "cloud_cover_high":          "nprohihs",
}

DAILY_PARAMS = {
    "temperature_2m_min": "tre200pn",
    "temperature_2m_max": "tre200px",
    "precipitation_sum":  "rka150p0",
    "weathercode_mch":    "jp2000d0",
}


# MeteoSwiss-Icon (1–35 Tag, 101–135 Nacht) → WMO-weather-code (best-effort).
# Quelle: MeteoSwiss-App Pictogramme. Ziel ist eine plausible Symbol-Auswahl
# im Widget; meteorologische Feinheiten bleiben unverändert in den Zahlenfeldern.
MCH_ICON_TO_WMO = {
    1: 0, 2: 1, 3: 2, 4: 3, 5: 3,
    6: 51, 7: 71, 8: 67,
    9: 80,         # Regenschauer
    10: 85,        # Schneeschauer
    11: 80,        # Schauer
    12: 95,        # Gewitter
    13: 95,        # Gewitter
    14: 61, 15: 63, 16: 71, 17: 73,
    18: 67, 19: 80, 20: 85,
    21: 53, 22: 75, 23: 67,
    24: 95, 25: 95,
    26: 1, 27: 2, 28: 3, 29: 3,
    30: 45, 31: 95, 32: 80, 33: 95,
    34: 71, 35: 95,
}


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing required env var: {name}")
    return v


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def latest_item():
    """Letztes STAC-Item (jüngster Run) — STAC liefert nach datetime DESC sortiert."""
    # `sortby=-properties.datetime` ist verlässlich; Default-Sortierung ist
    # asc. Wir holen die ersten 3 und nehmen das mit max datetime.
    r = requests.get(STAC_ITEMS, params={"limit": 5}, timeout=30)
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        sys.exit("STAC: keine Items in ch.meteoschweiz.ogd-local-forecasting")

    def dt(f):
        return f.get("properties", {}).get("datetime", "")

    feats.sort(key=dt, reverse=True)
    return feats[0]


def asset_url(item: dict, param: str) -> str | None:
    """Asset zu einem Parameter-Shortname suchen (Filename endet auf `.<param>.csv`)."""
    suffix = f".{param}.csv"
    for k, v in item.get("assets", {}).items():
        if k.endswith(suffix):
            href = v.get("href")
            if href:
                return href
    return None


def stream_csv(url: str, wanted_pids: set[int]) -> dict[int, list[tuple[str, str]]]:
    """Stream-Filter einer Param-CSV. Gibt {point_id: [(date, value), ...]} zurück.

    CSV-Format: point_id;point_type_id;Date;<param>
    Wir behalten nur Zeilen mit point_id in `wanted_pids`. Memory ≈ kB.
    """
    backoff = [5, 15, 30, 60]
    for attempt in range(len(backoff) + 1):
        out: dict[int, list[tuple[str, str]]] = {pid: [] for pid in wanted_pids}
        try:
            with requests.get(url, stream=True, timeout=(15, 300)) as r:
                if not r.ok:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                # iter_lines() hält den HTTP-Stream sauber offen bis EOF.
                # io.TextIOWrapper(r.raw) hatte den Stream nach dem ersten
                # Chunk geschlossen → leeres Resultat (vgl. plan.md).
                lines = r.iter_lines(decode_unicode=True, chunk_size=64 * 1024)
                reader = csv.reader(lines, delimiter=";")
                header = next(reader, None)
                if not header or len(header) < 4:
                    raise RuntimeError(f"unexpected header: {header}")
                for row in reader:
                    if len(row) < 4:
                        continue
                    try:
                        pid = int(row[0])
                    except ValueError:
                        continue
                    if pid in wanted_pids:
                        out[pid].append((row[2], row[3]))
                total = sum(len(v) for v in out.values())
                if total == 0:
                    raise RuntimeError(
                        f"stream_csv returned 0 rows for any wanted pid: {url}"
                    )
                return out
        except Exception as e:
            if attempt >= len(backoff):
                raise
            wait = backoff[attempt]
            print(f"WARN: {url} attempt {attempt + 1} failed ({e}); retry in {wait}s")
            time.sleep(wait)
    return out  # unreachable


def parse_dt(s: str) -> datetime:
    """MCH-Date 'YYYYMMDDHHMM' UTC → datetime (UTC)."""
    return datetime.strptime(s, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)


def parse_date(s: str) -> str:
    """MCH-Datum 'YYYYMMDDHHMM' → 'YYYY-MM-DD' (Datumsteil)."""
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def to_float(s: str) -> float | None:
    if s is None or s == "":
        return None
    try:
        v = float(s)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except ValueError:
        return None


def utc_offset_seconds_zurich(d: datetime) -> int:
    """Sehr einfache CH-Offset-Heuristik: letzter So März → letzter So Oktober = +2h, sonst +1h."""
    y = d.year
    # Letzter Sonntag März
    last_mar = datetime(y, 3, 31, 1, 0, tzinfo=timezone.utc)
    while last_mar.weekday() != 6:
        last_mar -= timedelta(days=1)
    # Letzter Sonntag Oktober
    last_oct = datetime(y, 10, 31, 1, 0, tzinfo=timezone.utc)
    while last_oct.weekday() != 6:
        last_oct -= timedelta(days=1)
    return 7200 if last_mar <= d < last_oct else 3600


def map_weathercode(v: float | None) -> float | None:
    if v is None:
        return None
    code = int(round(v))
    # Nacht-Pictogramme 101–135 spiegeln auf 1–35
    if 101 <= code <= 199:
        code -= 100
    return MCH_ICON_TO_WMO.get(code, 3)  # Fallback: bewölkt


def build_spot(spot: dict, hourly_data: dict[str, dict], daily_data: dict[str, dict]) -> dict:
    pid = spot["mch"]

    # ---- Hourly ----
    # Master-Zeitachse = Vereinigung aller hourly-Param-Zeitstempel.
    times: set[str] = set()
    for series in hourly_data.values():
        for date_s, _ in series.get(pid, []):
            times.add(date_s)
    sorted_dates = sorted(times)
    time_iso = [parse_dt(d).strftime("%Y-%m-%dT%H:%M") for d in sorted_dates]

    def series_for(param_key: str) -> list[float | None]:
        rows = hourly_data[param_key].get(pid, [])
        m = {d: to_float(v) for d, v in rows}
        return [m.get(d) for d in sorted_dates]

    temperature_2m = series_for("temperature_2m")
    precipitation = series_for("precipitation")
    precip_prob_3h = series_for("precipitation_probability")
    windspeed = series_for("windspeed_10m")
    windgusts = series_for("windgusts_10m")
    winddir = series_for("winddirection_10m")
    wcode_raw = series_for("weathercode_mch")
    sunshine_min = series_for("sunshine_minutes")
    cc_low = series_for("cloud_cover_low")
    cc_mid = series_for("cloud_cover_mid")
    cc_high = series_for("cloud_cover_high")

    weathercode = [map_weathercode(v) for v in wcode_raw]
    sunshine_seconds = [v * 60.0 if v is not None else None for v in sunshine_min]
    # MCH Cloud-Cover ist 0..1 Bedeckungsanteil → in % umrechnen.
    def to_percent(v: float | None) -> float | None:
        if v is None:
            return None
        # Wenn schon in % (>1), übernehmen, sonst skalieren.
        return v * 100.0 if v <= 1.0 else v

    cc_low_pct = [to_percent(v) for v in cc_low]
    cc_mid_pct = [to_percent(v) for v in cc_mid]
    cc_high_pct = [to_percent(v) for v in cc_high]

    # 3h-Probability auf jede Stunde innerhalb desselben 3h-Fensters spiegeln.
    # Wir kopieren den 3h-Wert vorwärts auf die folgenden 2 Stunden, sofern leer.
    precip_prob = list(precip_prob_3h)
    last_val = None
    for i in range(len(precip_prob)):
        if precip_prob[i] is not None:
            last_val = precip_prob[i]
        elif last_val is not None and i > 0 and (i % 3) != 0:
            precip_prob[i] = last_val
        else:
            last_val = None

    # ---- Daily ----
    daily_dates_set: set[str] = set()
    for series in daily_data.values():
        for date_s, _ in series.get(pid, []):
            daily_dates_set.add(parse_date(date_s))
    sorted_daily = sorted(daily_dates_set)

    def daily_series(param_key: str) -> list[float | None]:
        rows = daily_data[param_key].get(pid, [])
        m = {parse_date(d): to_float(v) for d, v in rows}
        return [m.get(d) for d in sorted_daily]

    d_tmin = daily_series("temperature_2m_min")
    d_tmax = daily_series("temperature_2m_max")
    d_psum = daily_series("precipitation_sum")
    d_wcode_raw = daily_series("weathercode_mch")
    d_weathercode = [map_weathercode(v) for v in d_wcode_raw]

    now = datetime.now(timezone.utc)
    offset = utc_offset_seconds_zurich(now)

    return {
        "id": spot["id"],
        "mchPointId": pid,
        "name": spot["name"],
        "latitude": spot["lat"],
        "longitude": spot["lon"],
        "utc_offset_seconds": offset,
        "timezone": ZURICH_TZ_NAME,
        "hourly": {
            "time": time_iso,
            "weathercode": weathercode,
            "temperature_2m": temperature_2m,
            "precipitation": precipitation,
            "precipitation_probability": precip_prob,
            "windspeed_10m": windspeed,
            "windgusts_10m": windgusts,
            "winddirection_10m": winddir,
            "snowfall": [0.0] * len(sorted_dates),  # nicht in dieser Param-Liste
            "sunshine_duration": sunshine_seconds,
            "cloud_cover_low": cc_low_pct,
            "cloud_cover_mid": cc_mid_pct,
            "cloud_cover_high": cc_high_pct,
        },
        "daily": {
            "time": sorted_daily,
            "weathercode": d_weathercode,
            "temperature_2m_min": d_tmin,
            "temperature_2m_max": d_tmax,
            "precipitation_sum": d_psum,
            # Restliche Daily-Felder werden im Reader aus dem Hourly re-aggregiert.
        },
    }


def main() -> None:
    print(f"MCH LOCAL FORECAST INGEST START version={VERSION}")
    item = latest_item()
    run_id = item.get("id")
    run_dt = item.get("properties", {}).get("datetime")
    print(f"latest STAC item: {run_id} ({run_dt})")

    wanted_pids = {s["mch"] for s in SPOTS}

    hourly_data: dict[str, dict[int, list[tuple[str, str]]]] = {}
    for key, param in HOURLY_PARAMS.items():
        url = asset_url(item, param)
        if not url:
            print(f"WARN: hourly param {param} ({key}) not in item — skipping")
            hourly_data[key] = {pid: [] for pid in wanted_pids}
            continue
        print(f"  hourly {param} ({key}) …", flush=True)
        hourly_data[key] = stream_csv(url, wanted_pids)

    daily_data: dict[str, dict[int, list[tuple[str, str]]]] = {}
    for key, param in DAILY_PARAMS.items():
        url = asset_url(item, param)
        if not url:
            print(f"WARN: daily param {param} ({key}) not in item — skipping")
            daily_data[key] = {pid: [] for pid in wanted_pids}
            continue
        print(f"  daily {param} ({key}) …", flush=True)
        daily_data[key] = stream_csv(url, wanted_pids)

    locations = [build_spot(s, hourly_data, daily_data) for s in SPOTS]
    for loc in locations:
        print(
            f"  {loc['id']:18} hourly={len(loc['hourly']['time']):>3}  "
            f"daily={len(loc['daily']['time']):>2}"
        )

    payload = {
        "version": VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "stacItemId": run_id,
        "stacItemDatetime": run_dt,
        "locations": locations,
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    s3 = make_s3()
    bucket = env("R2_BUCKET")
    key = os.environ.get("MCH_OUT_KEY", "mch/local_forecast.json")
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/json",
        CacheControl="public, max-age=60, s-maxage=300",
    )
    print(f"uploaded {key} ({len(body)} bytes)")
    print("done")


if __name__ == "__main__":
    main()
