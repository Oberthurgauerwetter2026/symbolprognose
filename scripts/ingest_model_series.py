"""Stündliche ICON-CH1/CH2-Reihen für die Niederschlags-Summenkarte nach R2.

Der Worker rechnet daraus die 12/24/48/72-h-Summen (Vergangenheit-Fallback
und Prognose) ohne eigene Open-Meteo-Abrufe. Werte als Base64-Int16:
precip/snow in 0.1 mm/cm, fzl in 10 m; -32768 = fehlend (nie 0).
"""
import base64, json, os, sys, time
import numpy as np
import requests

LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, STEP = 46.6, 48.6, 7.4, 11.6, 0.15
OUT_KEY = os.environ.get("MODEL_SERIES_KEY", "openmeteo/sums-series.json")
MISSING = -32768


def _range(a, b, s):
    out, v = [], a
    while v <= b + 1e-9:
        out.append(round(v, 3)); v += s
    return out


def gate_snow(snow, temp, fzl, elev):
    """Wie gateSnowfall in src/lib/precip-past.ts."""
    out = []
    for i, s in enumerate(snow):
        if s is None or s <= 0:
            out.append(s); continue
        t = temp[i] if temp else None
        if t is None:
            out.append(s); continue
        if t > 1.5:
            out.append(0.0); continue
        f = fzl[i] if fzl else None
        if f is not None and elev is not None and f - elev > 400:
            out.append(0.0); continue
        out.append(s)
    return out


def _pick(h, v):
    a = h.get(f"{v}_meteoswiss_icon_ch1"); b = h.get(f"{v}_meteoswiss_icon_ch2")
    if a is None:
        return b or h.get(v)
    return [x if x is not None else (b[i] if b else None) for i, x in enumerate(a)]


def _pack(vals, scale):
    arr = np.array([MISSING if v is None else max(-32767, min(32767, round(v * scale))) for v in vals], dtype="<i2")
    return base64.b64encode(arr.tobytes()).decode()


def fetch():
    lats, lons = _range(LAT_MIN, LAT_MAX, STEP), _range(LON_MIN, LON_MAX, STEP)
    pts = [(la, lo) for la in lats for lo in lons]
    locs = [None] * len(pts)
    B = 100
    for i in range(0, len(pts), B):
        sl = pts[i:i + B]
        params = {
            "latitude": ",".join(str(p[0]) for p in sl),
            "longitude": ",".join(str(p[1]) for p in sl),
            "hourly": "precipitation,snowfall,temperature_2m,freezing_level_height",
            "past_days": 3, "forecast_days": 5, "timezone": "GMT",
            "models": "meteoswiss_icon_ch1,meteoswiss_icon_ch2",
        }
        for attempt in range(4):
            try:
                r = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=60)
                if r.ok:
                    j = r.json(); j = j if isinstance(j, list) else [j]
                    for k, l in enumerate(j):
                        locs[i + k] = l
                    break
                print(f"[series] batch {i}: HTTP {r.status_code}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[series] batch {i}: {e}", flush=True)
            time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(f"batch {i} failed")
        time.sleep(1)
    times = locs[0]["hourly"]["time"]
    precip, snow, fzl = [], [], []
    for l in locs:
        h = l.get("hourly", {})
        if h.get("time") != times:
            raise RuntimeError("inconsistent time axis")
        p = _pick(h, "precipitation") or [None] * len(times)
        f = _pick(h, "freezing_level_height") or [None] * len(times)
        s = gate_snow(_pick(h, "snowfall") or [None] * len(times), _pick(h, "temperature_2m"), f, l.get("elevation"))
        precip += p; snow += s; fzl += f
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "gridLat": lats, "gridLon": lons,
        "times": times, "nTimes": len(times),
        "precip": _pack(precip, 10), "snow": _pack(snow, 10), "fzl": _pack(fzl, 0.1),
        "source": "MeteoSchweiz ICON-CH1/CH2 via Open-Meteo",
    }


def main():
    import boto3
    data = fetch()
    s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                      region_name="auto")
    s3.put_object(Bucket=os.environ["R2_BUCKET"], Key=OUT_KEY, Body=json.dumps(data, separators=(",", ":")).encode(),
                  ContentType="application/json", CacheControl="public, max-age=120")
    print(f"[series] published {OUT_KEY}: {len(data['gridLat'])}x{len(data['gridLon'])} x {data['nTimes']} h", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"[series] soft-fail: {e}", flush=True)
        sys.exit(0)
