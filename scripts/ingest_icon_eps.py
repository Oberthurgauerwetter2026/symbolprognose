#!/usr/bin/env python3
"""
ICON-CH1-EPS / ICON-CH2-EPS → Cloudflare R2 ingest (Phase 1).

Pulls the latest complete EPS forecast run for `TOT_PREC` (accumulated
precipitation) from MeteoSchweiz OGD-STAC, expands the 21 ensemble members
(1 ctrl + 20 perturbed), de-accumulates to hourly mm/h, resamples to the
Oberthurgau Web-Mercator bbox, computes the ensemble mean and
P(>0.1 mm/h), and uploads coloured PNGs + a manifest to R2.

Object layout in R2:
  radar/eps/<model>/<runIso>/<stepIso>_mean.png
  radar/eps/<model>/<runIso>/<stepIso>_prob.png      (8-bit greyscale, 0..255 → 0..100 %)
  radar/eps/<model>/<runIso>/meta.json
  radar/eps/latest.json                              ← read by the Worker

`latest.json` schema:
  {
    "generatedAt": "...",
    "models": {
      "ch1": { "run": "2026-05-28T15:00:00Z", "bbox": {...}, "steps": [
          { "t": "...", "horizon_h": 1, "meanUrl": "...", "probUrl": "...",
            "members": 21, "maxMmh": 4.3, "meanWetFrac": 0.12 },
          ...
      ]},
      "ch2": { ... }
    }
  }

The frontend (Phase 2) will consume `latest.json` and render `meanUrl` as a
Leaflet ImageOverlay, replacing the deterministic ICON-CH1 minutely_15
branch. While Phase 2 is not shipped yet, this ingest can already populate
R2 — the existing radar pipeline is untouched.

ENV (required): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
                R2_BUCKET, R2_PUBLIC_URL
ENV (optional): EPS_MODELS              default "ch1,ch2"
                EPS_KEEP_RUNS           default 2
                EPS_MAX_HORIZON_CH1     default 33
                EPS_MAX_HORIZON_CH2     default 120
                EPS_CONCURRENCY         default 4
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

import boto3
import numpy as np
import pygrib
import requests
from PIL import Image
from pyproj import Transformer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

EPS_INGEST_VERSION = "v1-mean-prob"
STAC_BASE = "https://data.geo.admin.ch/api/stac/v1/collections"
# Member counts per MeteoSchweiz spec:
#   ch1: 11 members (1 control + 10 perturbed)
#   ch2: 21 members (1 control + 20 perturbed)
COLLECTIONS = {
    "ch1": "ch.meteoschweiz.ogd-forecasting-icon-ch1",
    "ch2": "ch.meteoschweiz.ogd-forecasting-icon-ch2",
}
MAX_HORIZON = {
    "ch1": int(os.environ.get("EPS_MAX_HORIZON_CH1", "33")),
    "ch2": int(os.environ.get("EPS_MAX_HORIZON_CH2", "120")),
}
MODELS = [m.strip() for m in os.environ.get("EPS_MODELS", "ch1,ch2").split(",") if m.strip()]
KEEP_RUNS = int(os.environ.get("EPS_KEEP_RUNS", "2"))
CONCURRENCY = int(os.environ.get("EPS_CONCURRENCY", "4"))

# Same bbox as radar PNGs, so EPS overlays land-register exactly on top of CPC.
BBOX_WGS = {"minLon": 8.15, "maxLon": 10.55, "minLat": 46.85, "maxLat": 48.30}
OUT_W, OUT_H = 1024, 768

# mm/h colour scale — identical to scripts/ingest_radar.py PRECIP_SCALE and
# src/components/maps/radar-map.tsx SCALE so EPS-forecast PNGs match measured
# CPC PNGs visually.
PRECIP_SCALE: list[tuple[float, tuple[int, int, int, int]]] = [
    (0.2, (167, 174, 211, 89)),
    (1.0, (30, 60, 230, 153)),
    (2.0, (30, 120, 50, 153)),
    (4.0, (70, 200, 70, 153)),
    (6.0, (240, 235, 50, 153)),
    (10.0, (240, 200, 120, 153)),
    (20.0, (240, 140, 30, 153)),
    (40.0, (225, 30, 30, 153)),
    (60.0, (150, 30, 200, 153)),
]

# ---------------------------------------------------------------------------
# R2 client
# ---------------------------------------------------------------------------


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


BUCKET = os.environ.get("R2_BUCKET", "")
PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")


# ---------------------------------------------------------------------------
# HTTP helper with retry
# ---------------------------------------------------------------------------


def http_get(url: str, *, timeout: int = 90, attempts: int = 4) -> requests.Response:
    last: Exception | None = None
    for i in range(attempts):
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code >= 500 or r.status_code == 429:
                raise requests.HTTPError(f"{r.status_code} for {url}", response=r)
            return r
        except Exception as exc:  # noqa: BLE001
            last = exc
            if i == attempts - 1:
                break
            sleep_s = 2**i
            print(f"  retry {i+1}/{attempts-1} after {sleep_s}s: {exc!r}", flush=True)
            time.sleep(sleep_s)
    assert last is not None
    raise last


# ---------------------------------------------------------------------------
# STAC: find latest complete TOT_PREC run + items
# ---------------------------------------------------------------------------


@dataclass
class StacItem:
    item_id: str
    ref_time: datetime
    horizon_h: int
    variable: str
    perturbed: bool
    href: str
    asset_key: str


def _list_items_page(coll: str, params: dict, limit: int = 100) -> Iterable[dict]:
    """Yield STAC features matching the params, following next-page links."""
    base = f"{STAC_BASE}/{coll}/items"
    qp = dict(params)
    qp.setdefault("limit", limit)
    url = base + "?" + "&".join(f"{k}={v}" for k, v in qp.items())
    while url:
        r = http_get(url, timeout=60)
        r.raise_for_status()
        d = r.json()
        for f in d.get("features", []) or []:
            yield f
        nxt = None
        for l in d.get("links", []) or []:
            if l.get("rel") == "next":
                nxt = l.get("href")
                break
        url = nxt


def _item_to_stac(feature: dict) -> StacItem | None:
    """Map a STAC feature with exactly one .grib2 asset into a StacItem."""
    props = feature.get("properties") or {}
    ref_iso = props.get("forecast:reference_datetime")
    horizon = props.get("forecast:horizon")
    var = props.get("forecast:variable")
    perturbed = bool(props.get("forecast:perturbed"))
    if not ref_iso or horizon is None or not var:
        return None
    try:
        ref_time = datetime.fromisoformat(ref_iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None
    # forecast:horizon comes as full ISO-8601 duration like "P0DT10H00M00S",
    # short form "PT5H", or plain int hours.
    if isinstance(horizon, (int, float)):
        h_int = int(horizon)
    else:
        m = re.match(
            r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$",
            str(horizon),
        )
        if not m:
            return None
        days = int(m.group(1) or 0)
        hours = int(m.group(2) or 0)
        # Minutes/seconds ignored — EPS steps are hourly.
        h_int = days * 24 + hours
    assets = feature.get("assets") or {}
    if not assets:
        return None
    key = next(iter(assets))
    href = (assets[key] or {}).get("href")
    if not href:
        return None
    return StacItem(
        item_id=feature.get("id") or "",
        ref_time=ref_time,
        horizon_h=h_int,
        variable=var.lower(),
        perturbed=perturbed,
        href=href,
        asset_key=key,
    )


def find_latest_run(model: str) -> tuple[datetime, list[StacItem]] | None:
    """Find the most recent ref_time for which BOTH ctrl + perturbed TOT_PREC
    files exist for at least horizons 1..min(MAX,3) — i.e. the run has started
    publishing. Returns (ref_time, items-for-that-run-and-tot_prec).

    The OGD STAC item ID encodes (date, hour, horizon, variable, ctrl|perturbed),
    so we filter via the `forecast:variable=tot_prec` query parameter and group
    by `forecast:reference_datetime`.
    """
    coll = COLLECTIONS[model]
    # An EPS run is published every 3h, so a 12h window covers ~4 runs — plenty.
    since = (datetime.now(tz=timezone.utc) - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ")
    until = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "datetime": f"{since}/{until}",
        "forecast:variable": "tot_prec",
    }
    items: list[StacItem] = []
    n_features = 0
    first_raw: dict | None = None
    for feat in _list_items_page(coll, params, limit=200):
        n_features += 1
        if first_raw is None:
            first_raw = feat
        si = _item_to_stac(feat)
        if si is None:
            continue
        if si.variable != "tot_prec":
            continue
        items.append(si)
    print(f"  [{model}] STAC tot_prec items in window: features={n_features} parsed={len(items)}", flush=True)
    if n_features > 0 and not items and first_raw is not None:
        # Schema-drift diagnostic — dump the first feature so we see what changed.
        try:
            sample = {
                "id": first_raw.get("id"),
                "properties": first_raw.get("properties"),
                "asset_keys": list((first_raw.get("assets") or {}).keys()),
            }
            print(f"  [{model}] schema sample: {json.dumps(sample)[:600]}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"  [{model}] schema sample dump failed: {e!r}", flush=True)

    if not items:
        return None

    # Group by ref_time.
    by_run: dict[datetime, list[StacItem]] = {}
    for it in items:
        by_run.setdefault(it.ref_time, []).append(it)
    # Pick newest run that has at least 1 perturbed + 1 ctrl item for horizons 1..3.
    for ref_time in sorted(by_run.keys(), reverse=True):
        run_items = by_run[ref_time]
        horizons = {it.horizon_h for it in run_items if 1 <= it.horizon_h <= 3}
        has_ctrl = any((not it.perturbed) and 1 <= it.horizon_h <= 3 for it in run_items)
        has_pert = any(it.perturbed and 1 <= it.horizon_h <= 3 for it in run_items)
        if has_ctrl and has_pert and len(horizons) >= 1:
            print(f"  [{model}] selected run {ref_time.isoformat()} "
                  f"with {len(run_items)} tot_prec items", flush=True)
            return ref_time, run_items
    print(f"  [{model}] no run with both ctrl+perturbed for h1..3 found", flush=True)
    return None


# ---------------------------------------------------------------------------
# GRIB2 → numpy
# ---------------------------------------------------------------------------


def _safe_get(msg, key):
    """Return msg[key] or None — never raises."""
    try:
        return msg[key]
    except Exception:
        return None


def _safe_attr(msg, name):
    try:
        return getattr(msg, name)
    except Exception:
        return None


_LAT_KEYS = ("latitudes", "distinctLatitudes", "latitudeOfFirstGridPointInDegrees")
_LON_KEYS = ("longitudes", "distinctLongitudes", "longitudeOfFirstGridPointInDegrees")

# Cache to avoid logging the same diagnostic for every message / file.
_GRID_DIAG_SEEN: set[str] = set()

# Per-process cache of (lats, lons) arrays per model, loaded from the
# `horizontal_constants_icon-<model>-eps.grib2` collection asset.
_GRID_CACHE: dict[str, tuple[np.ndarray, np.ndarray]] = {}

# Limit per-message metadata diagnostics so we don't spam the log.
_MSG_DIAG_SEEN: set[str] = set()
_MSG_DIAG_LIMIT = 4


def _load_horizontal_grid(model: str) -> tuple[np.ndarray, np.ndarray] | None:
    """Fetch and decode the static horizontal grid (CLAT/CLON in radians)
    for an ICON-CH<n>-EPS model. Returns (lats_deg, lons_deg) as 1D float32
    arrays, or None on failure. Result is cached per-process per model.
    """
    if model in _GRID_CACHE:
        return _GRID_CACHE[model]
    collection_id = COLLECTIONS[model]
    asset_name = f"horizontal_constants_icon-{model}-eps.grib2"
    url = f"{STAC_BASE}/{collection_id}"
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        assets = r.json().get("assets", {})
        asset = assets.get(asset_name)
        if not asset or not asset.get("href"):
            print(f"  [grid] {model}: asset {asset_name} not found in collection", flush=True)
            return None
        href = asset["href"]
        gr = requests.get(href, timeout=120)
        gr.raise_for_status()
        buf = gr.content
    except Exception as exc:
        print(f"  [grid] {model}: fetch failed {exc!r}", flush=True)
        return None

    lats_rad = None
    lons_rad = None
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=True) as f:
        f.write(buf)
        f.flush()
        try:
            with pygrib.open(f.name) as gribs:
                for msg in gribs:
                    short = (_safe_attr(msg, "shortName") or "").lower()
                    name = (_safe_attr(msg, "name") or "").lower()
                    try:
                        vals = np.asarray(msg.values, dtype=np.float64).reshape(-1)
                    except Exception:
                        continue
                    if short == "clat" or "latitude" in name:
                        lats_rad = vals
                    elif short == "clon" or "longitude" in name:
                        lons_rad = vals
        except Exception as exc:
            print(f"  [grid] {model}: grib decode failed {exc!r}", flush=True)
            return None

    if lats_rad is None or lons_rad is None:
        print(f"  [grid] {model}: CLAT/CLON not found in {asset_name}", flush=True)
        return None
    if lats_rad.size != lons_rad.size:
        print(f"  [grid] {model}: CLAT/CLON size mismatch "
              f"{lats_rad.size} vs {lons_rad.size}", flush=True)
        return None

    # MeteoSwiss ICON horizontal constants store CLAT/CLON in radians.
    # If values look like radians (|max| < ~7), convert to degrees.
    if max(abs(float(lats_rad.min())), abs(float(lats_rad.max()))) < 7.0:
        lats_deg = np.degrees(lats_rad).astype(np.float32)
        lons_deg = np.degrees(lons_rad).astype(np.float32)
    else:
        lats_deg = lats_rad.astype(np.float32)
        lons_deg = lons_rad.astype(np.float32)
    lons_deg = np.where(lons_deg > 180.0, lons_deg - 360.0, lons_deg).astype(np.float32)
    print(f"  [grid] loaded {model} grid: {lats_deg.size} points "
          f"lat=[{float(lats_deg.min()):.3f},{float(lats_deg.max()):.3f}] "
          f"lon=[{float(lons_deg.min()):.3f},{float(lons_deg.max()):.3f}]",
          flush=True)
    _GRID_CACHE[model] = (lats_deg, lons_deg)
    return _GRID_CACHE[model]


def _open_grib_messages(
    buf: bytes,
    model: str | None = None,
    is_ctrl: bool = False,
) -> list[tuple[int, np.ndarray, np.ndarray, np.ndarray]]:
    """Return list of (member_key, values, lats, lons) for every message in a GRIB2 file.

    `member_key` is `-1` for the control run and `int(perturbationNumber)` for
    perturbed members. The caller relies on this key to keep the member axis
    deterministic across horizons (otherwise the de-accumulation `cur - prev`
    silently subtracts the wrong members).

    For regular grids we use `msg.latlons()`. For ICON's native
    `unstructured_grid`, lat/lon are typically NOT embedded in the GRIB —
    only `values` and a `uuidOfHGrid` reference to an external grid file.
    We try a small list of candidate ecCodes keys; if none are present we
    log one diagnostic per UUID (instead of one error per message) and
    skip those messages.
    """
    def _log_msg_diag(msg, values: np.ndarray, model_key: str | None) -> None:
        tag = f"{model_key or '?'}::{_safe_attr(msg, 'shortName')}"
        if tag in _MSG_DIAG_SEEN or len(_MSG_DIAG_SEEN) >= _MSG_DIAG_LIMIT:
            return
        _MSG_DIAG_SEEN.add(tag)
        try:
            flat = np.asarray(values, dtype=np.float64).reshape(-1)
            finite = flat[np.isfinite(flat)]
            mn = float(finite.min()) if finite.size else float("nan")
            mx = float(finite.max()) if finite.size else float("nan")
            me = float(finite.mean()) if finite.size else float("nan")
            n_pos = int((finite > 0).sum())
        except Exception:
            mn = mx = me = float("nan")
            n_pos = -1
        print(
            f"    [msg-diag] model={model_key} "
            f"shortName={_safe_attr(msg, 'shortName')} name={_safe_attr(msg, 'name')!r} "
            f"units={_safe_get(msg, 'units')} paramId={_safe_get(msg, 'paramId')} "
            f"typeOfLevel={_safe_get(msg, 'typeOfLevel')} level={_safe_get(msg, 'level')} "
            f"pert#={_safe_get(msg, 'perturbationNumber')} "
            f"stepRange={_safe_get(msg, 'stepRange')} "
            f"native min={mn:.4f} max={mx:.4f} mean={me:.4f} n>0={n_pos}",
            flush=True,
        )
    out: list[tuple[int, np.ndarray, np.ndarray, np.ndarray]] = []
    n_msgs = 0
    n_unstructured_skipped = 0
    last_diag: str | None = None
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=True) as f:
        f.write(buf)
        f.flush()
        with pygrib.open(f.name) as gribs:
            for msg in gribs:
                n_msgs += 1
                grid_type = ""
                try:
                    grid_type = str(msg.gridType)
                except Exception:
                    pass

                if grid_type == "unstructured_grid":
                    uuid = (
                        _safe_get(msg, "uuidOfHGrid")
                        or _safe_get(msg, "numberOfGridUsed")
                        or "?"
                    )
                    uuid_s = str(uuid)

                    # Try to locate embedded coords.
                    lats_arr = None
                    lons_arr = None
                    for k in _LAT_KEYS:
                        v = _safe_get(msg, k)
                        if v is not None:
                            try:
                                lats_arr = np.asarray(v, dtype=np.float32).reshape(-1)
                                break
                            except Exception:
                                lats_arr = None
                    for k in _LON_KEYS:
                        v = _safe_get(msg, k)
                        if v is not None:
                            try:
                                lons_arr = np.asarray(v, dtype=np.float32).reshape(-1)
                                break
                            except Exception:
                                lons_arr = None

                    if lats_arr is None or lons_arr is None:
                        # Fallback: load the static horizontal grid for this
                        # model from the STAC collection asset (CLAT/CLON).
                        if model is not None:
                            grid = _load_horizontal_grid(model)
                            if grid is not None:
                                lats_arr, lons_arr = grid

                    if lats_arr is None or lons_arr is None:
                        n_unstructured_skipped += 1
                        if uuid_s not in _GRID_DIAG_SEEN:
                            _GRID_DIAG_SEEN.add(uuid_s)
                            ndp = _safe_get(msg, "numberOfDataPoints")
                            short = _safe_attr(msg, "shortName")
                            vals_size = None
                            try:
                                vals_size = int(np.asarray(msg.values).size)
                            except Exception:
                                pass
                            last_diag = (
                                f"unstructured_grid without embedded coords: "
                                f"shortName={short} numberOfDataPoints={ndp} "
                                f"values.size={vals_size} uuidOfHGrid={uuid_s}"
                            )
                            print(f"    [diag] {last_diag}", flush=True)
                        continue

                    try:
                        values = np.asarray(msg.values, dtype=np.float32).reshape(-1)
                    except Exception as exc:
                        print(f"    ! values read failed: {exc!r}", flush=True)
                        continue
                    if not (values.size == lats_arr.size == lons_arr.size):
                        print(
                            f"    ! unstructured size mismatch values={values.size} "
                            f"lats={lats_arr.size} lons={lons_arr.size}",
                            flush=True,
                        )
                        continue
                    lons_arr = np.where(lons_arr > 180.0, lons_arr - 360.0, lons_arr).astype(np.float32)
                    _log_msg_diag(msg, values, model)
                    pn = _safe_get(msg, "perturbationNumber")
                    mkey = -1 if is_ctrl else (int(pn) if pn is not None else -2)
                    out.append((mkey, values, lats_arr, lons_arr))
                    continue

                # Regular grid path.
                try:
                    values = np.asarray(msg.values, dtype=np.float32)
                    lats, lons = msg.latlons()
                    _log_msg_diag(msg, values, model)
                    pn = _safe_get(msg, "perturbationNumber")
                    mkey = -1 if is_ctrl else (int(pn) if pn is not None else -2)
                    out.append((mkey, values, lats.astype(np.float32), lons.astype(np.float32)))
                except Exception as exc:
                    print(
                        f"    ! grib decode skipped gridType={grid_type} "
                        f"shortName={_safe_attr(msg, 'shortName')} err={exc!r}",
                        flush=True,
                    )
                    continue
    if n_unstructured_skipped and not out:
        print(
            f"    [diag] {n_unstructured_skipped}/{n_msgs} messages skipped — "
            f"need external ICON grid file to resolve coordinates. last={last_diag}",
            flush=True,
        )
    return out


def _build_resample_index(lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """For each output pixel, return the flat index into the native grid using
    nearest-neighbour. The native grid is irregular in WGS84 (it's a rotated
    pole projection), so we do a KD-style nearest using a coarse hash.

    Strategy: project both native and output points to plain (lon, lat) plane
    (good enough at this latitude / 2.4° wide bbox), build a KD-tree-like
    bucket grid, and query nearest.

    Returns: int32 array of length OUT_H*OUT_W, value -1 = out of native domain.
    """
    flat_lat = np.asarray(lats, dtype=np.float32).reshape(-1)
    flat_lon = np.asarray(lons, dtype=np.float32).reshape(-1)

    # Native bbox sanity check — should comfortably cover BBOX_WGS.
    if (flat_lat.min() > BBOX_WGS["minLat"] or flat_lat.max() < BBOX_WGS["maxLat"]
        or flat_lon.min() > BBOX_WGS["minLon"] or flat_lon.max() < BBOX_WGS["maxLon"]):
        print(f"  WARN native grid {flat_lat.min():.2f}..{flat_lat.max():.2f} "
              f"/ {flat_lon.min():.2f}..{flat_lon.max():.2f} does not cover bbox",
              flush=True)

    # Coarse bucket grid over the bbox of the native grid.
    BUCK = 200
    minLa, maxLa = float(flat_lat.min()), float(flat_lat.max())
    minLo, maxLo = float(flat_lon.min()), float(flat_lon.max())
    spanLa = max(1e-6, maxLa - minLa)
    spanLo = max(1e-6, maxLo - minLo)
    buckets: dict[int, list[int]] = {}
    bx = ((flat_lon - minLo) / spanLo * (BUCK - 1)).astype(np.int32)
    by = ((flat_lat - minLa) / spanLa * (BUCK - 1)).astype(np.int32)
    for i in range(flat_lat.size):
        buckets.setdefault(int(by[i]) * BUCK + int(bx[i]), []).append(i)

    out_lons = np.linspace(BBOX_WGS["minLon"], BBOX_WGS["maxLon"], OUT_W, dtype=np.float32)
    out_lats = np.linspace(BBOX_WGS["maxLat"], BBOX_WGS["minLat"], OUT_H, dtype=np.float32)
    olon_grid, olat_grid = np.meshgrid(out_lons, out_lats)

    idx_out = np.full(OUT_H * OUT_W, -1, dtype=np.int32)
    olo = olon_grid.reshape(-1)
    ola = olat_grid.reshape(-1)
    bx_o = ((olo - minLo) / spanLo * (BUCK - 1)).astype(np.int32)
    by_o = ((ola - minLa) / spanLa * (BUCK - 1)).astype(np.int32)
    bx_o = np.clip(bx_o, 0, BUCK - 1)
    by_o = np.clip(by_o, 0, BUCK - 1)

    for k in range(olo.size):
        bestI = -1
        bestD = 1e18
        bx0, by0 = int(bx_o[k]), int(by_o[k])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                key = (by0 + dy) * BUCK + (bx0 + dx)
                cands = buckets.get(key)
                if not cands:
                    continue
                for i in cands:
                    d = (flat_lon[i] - olo[k]) ** 2 + (flat_lat[i] - ola[k]) ** 2
                    if d < bestD:
                        bestD = float(d)
                        bestI = i
        idx_out[k] = bestI
    n_unmapped = int((idx_out < 0).sum())
    print(
        f"  [resample-idx] {OUT_H}x{OUT_W} pixels mapped, unmapped={n_unmapped} "
        f"native_pts={flat_lat.size} bbox_lat=[{BBOX_WGS['minLat']},{BBOX_WGS['maxLat']}] "
        f"bbox_lon=[{BBOX_WGS['minLon']},{BBOX_WGS['maxLon']}]",
        flush=True,
    )
    return idx_out


def resample(values: np.ndarray, resample_idx: np.ndarray) -> np.ndarray:
    """Apply the precomputed nearest-neighbour index. -1 → NaN."""
    flat = values.reshape(-1)
    out = np.full(resample_idx.size, np.nan, dtype=np.float32)
    mask = resample_idx >= 0
    out[mask] = flat[resample_idx[mask]]
    return out.reshape(OUT_H, OUT_W)


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def render_mean_png(mmh: np.ndarray) -> bytes:
    h, w = mmh.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for thresh, color in PRECIP_SCALE:
        m = (~np.isnan(mmh)) & (mmh >= thresh)
        rgba[m] = color
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_prob_png(prob: np.ndarray) -> bytes:
    """8-bit single-channel PNG. 0..255 maps linearly to 0..100 %.
    Used by Phase 2 frontend if/when we render uncertainty contours."""
    h, w = prob.shape
    arr = np.clip(np.nan_to_num(prob, nan=0.0) * 2.55, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Pipeline per model
# ---------------------------------------------------------------------------


def head_exists(s3, key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except Exception:
        return False


def upload(s3, key: str, body: bytes, content_type: str, cache: str) -> None:
    s3.put_object(
        Bucket=BUCKET, Key=key, Body=body,
        ContentType=content_type, CacheControl=cache,
    )


def download_item(it: StacItem) -> bytes:
    print(f"    fetch h={it.horizon_h:>3} {'pert' if it.perturbed else 'ctrl'} "
          f"{it.asset_key[:60]}", flush=True)
    r = http_get(it.href, timeout=120)
    r.raise_for_status()
    return r.content


def process_model(s3, model: str, ref_time: datetime, items: list[StacItem]) -> dict | None:
    """Download all TOT_PREC items for the run, compute mean+prob per horizon,
    upload PNGs and per-run meta. Returns the manifest entry for latest.json."""
    max_h = MAX_HORIZON[model]
    # Group items by horizon.
    by_h: dict[int, list[StacItem]] = {}
    for it in items:
        if 0 <= it.horizon_h <= max_h:
            by_h.setdefault(it.horizon_h, []).append(it)
    horizons = sorted(by_h.keys())
    if not horizons:
        print(f"  [{model}] no horizons in [0..{max_h}]", flush=True)
        return None

    run_iso = ref_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    run_key_prefix = f"radar/eps/{model}/{ref_time.strftime('%Y%m%dT%H%M')}"
    print(f"  [{model}] run={run_iso} horizons={horizons[0]}..{horizons[-1]} "
          f"({len(horizons)} hours)", flush=True)

    # We need accumulated TOT_PREC at each horizon for every member to
    # de-accumulate. First decode horizon 0 (if present) as the zero baseline,
    # otherwise we treat the lowest available horizon as the baseline (= NaN
    # for the first step we emit).
    resample_idx: np.ndarray | None = None
    prev_accum: np.ndarray | None = None  # shape (members, H, W), accumulated mm
    prev_h: int | None = None
    steps_meta: list[dict] = []

    def decode_horizon(h: int) -> np.ndarray | None:
        """Return (members, H, W) accumulated TOT_PREC in mm for horizon h."""
        nonlocal resample_idx
        h_items = by_h.get(h) or []
        if not h_items:
            return None
        # Download ctrl + perturbed in parallel.
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
            futs = {ex.submit(download_item, it): it for it in h_items}
            buffers: list[tuple[bool, bytes]] = []
            for fut in as_completed(futs):
                it = futs[fut]
                try:
                    buffers.append((not it.perturbed, fut.result()))
                except Exception as exc:
                    print(f"    ! download fail h={h}: {exc!r}", flush=True)
        pairs: list[tuple[int, np.ndarray]] = []
        for is_ctrl, buf in buffers:
            try:
                msgs = _open_grib_messages(buf, model=model, is_ctrl=is_ctrl)
            except Exception as exc:
                print(f"    ! grib decode fail h={h}: {exc!r}", flush=True)
                continue
            for mkey, values, lats, lons in msgs:
                if resample_idx is None:
                    print(f"    building resample index from {values.shape} grid", flush=True)
                    resample_idx = _build_resample_index(lats, lons)
                cropped = resample(values, resample_idx)
                pairs.append((mkey, cropped))
        if not pairs:
            return None
        # Stable member axis: sort by member_key so cur/prev align across horizons.
        pairs.sort(key=lambda p: p[0])
        member_keys = [p[0] for p in pairs]
        members = [p[1] for p in pairs]
        stack = np.stack(members, axis=0)
        finite = stack[np.isfinite(stack)]
        s_min = float(finite.min()) if finite.size else float("nan")
        s_max = float(finite.max()) if finite.size else float("nan")
        s_mean = float(finite.mean()) if finite.size else float("nan")
        n_pos = int((finite > 0).sum())
        members_with_rain = 0
        for m in members:
            mf = m[np.isfinite(m)]
            if mf.size and float(mf.max()) > 0.0:
                members_with_rain += 1
        if len(member_keys) <= 6:
            keys_repr = str(member_keys)
        else:
            keys_repr = f"[{member_keys[0]},{member_keys[1]},{member_keys[2]},…,{member_keys[-2]},{member_keys[-1]}]"
        print(
            f"    h={h:>3} members={len(members)} "
            f"stack_accum_mean={s_mean:.4f}mm "
            f"[stack min={s_min:.3f} max={s_max:.3f} n>0={n_pos} "
            f"members_with_rain={members_with_rain}/{len(members)} "
            f"keys={keys_repr}]",
            flush=True,
        )
        # Attach member_keys to the stack via a sentinel attribute on a wrapper
        # is overkill; instead store in a closure dict for drift detection.
        _last_member_keys[h] = tuple(member_keys)
        return stack


    # Try horizon 0 as baseline (TOT_PREC at h=0 = 0 by definition, but if the
    # item is missing we just synthesise zeros once we know member count).
    base = decode_horizon(0)
    if base is None and 1 in by_h:
        # Synthesize zero baseline matching member count we'll see at h=1.
        first = decode_horizon(1)
        if first is not None:
            base = np.zeros_like(first)
            prev_accum = base
            prev_h = 0
            # And immediately emit step h=1 (interval 0→1) using first - base.
            _emit_step(s3, model, run_key_prefix, ref_time, 1, first, base,
                       interval_h=1, steps_meta=steps_meta)
            prev_accum = first
            prev_h = 1
    else:
        prev_accum = base
        prev_h = 0

    for h in horizons:
        if prev_h is not None and h <= prev_h:
            continue
        cur = decode_horizon(h)
        if cur is None:
            print(f"    h={h:>3} skipped (no data)", flush=True)
            continue
        if prev_accum is None or prev_accum.shape != cur.shape:
            prev_accum = np.zeros_like(cur)
            prev_h = h - 1
        interval = max(1, h - (prev_h or 0))
        _emit_step(s3, model, run_key_prefix, ref_time, h, cur, prev_accum,
                   interval_h=interval, steps_meta=steps_meta)
        prev_accum = cur
        prev_h = h

    if not steps_meta:
        print(f"  [{model}] no steps emitted", flush=True)
        return None

    # Per-run meta.json + manifest entry.
    meta = {
        "model": model,
        "run": run_iso,
        "bbox": BBOX_WGS,
        "members_total": max(s["members"] for s in steps_meta),
        "ingestVersion": EPS_INGEST_VERSION,
        "steps": steps_meta,
    }
    upload(s3, f"{run_key_prefix}/meta.json",
           json.dumps(meta).encode("utf-8"),
           "application/json", "public, max-age=300")
    return {
        "model": model,
        "run": run_iso,
        "bbox": BBOX_WGS,
        "metaUrl": f"{PUBLIC_URL}/{run_key_prefix}/meta.json",
        "steps": steps_meta,
    }


def _emit_step(s3, model: str, run_key_prefix: str, ref_time: datetime,
               h: int, cur_accum: np.ndarray, prev_accum: np.ndarray,
               interval_h: int, steps_meta: list[dict]) -> None:
    """De-accumulate, compute mean+prob, render and upload PNGs."""
    # mm in this interval per member, clipped to >=0 (handle MCH numerical noise).
    delta = np.clip(cur_accum - prev_accum, 0.0, None)
    mmh = delta / max(1.0, float(interval_h))   # mm/h equivalent

    mean = np.nanmean(mmh, axis=0)
    prob = (mmh > 0.1).mean(axis=0) * 100.0    # P(>0.1 mm/h) in %
    max_mmh = float(np.nanmax(mean)) if mean.size else 0.0
    wet_frac = float((mean > 0.1).mean())
    n_wet_px = int((mean > 0.1).sum())
    mean_max_member = float(np.nanmax(mmh)) if mmh.size else 0.0
    print(
        f"    [emit h={h:>3} interval={interval_h}h max_mmh={max_mmh:.3f} "
        f"wet_frac={wet_frac:.4f} n_wet_px={n_wet_px} "
        f"mean_max_member={mean_max_member:.3f}]",
        flush=True,
    )

    step_time = ref_time + timedelta(hours=h)
    step_iso = step_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    tag = step_time.strftime("%Y%m%dT%H%M")
    mean_key = f"{run_key_prefix}/{tag}_mean.png"
    prob_key = f"{run_key_prefix}/{tag}_prob.png"

    if not head_exists(s3, mean_key):
        upload(s3, mean_key, render_mean_png(mean), "image/png",
               "public, max-age=21600, immutable")
    if not head_exists(s3, prob_key):
        upload(s3, prob_key, render_prob_png(prob), "image/png",
               "public, max-age=21600, immutable")

    steps_meta.append({
        "t": step_iso,
        "horizon_h": h,
        "interval_h": interval_h,
        "members": int(mmh.shape[0]),
        "meanUrl": f"{PUBLIC_URL}/{mean_key}",
        "probUrl": f"{PUBLIC_URL}/{prob_key}",
        "maxMmh": round(max_mmh, 3),
        "meanWetFrac": round(wet_frac, 4),
    })


def cleanup_old_runs(s3, model: str, keep_run_keys: set[str]) -> None:
    """Delete radar/eps/<model>/<runTag>/* objects whose runTag is not in keep set."""
    paginator = s3.get_paginator("list_objects_v2")
    prefix = f"radar/eps/{model}/"
    to_delete: list[str] = []
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []) or []:
            k = obj["Key"]
            rest = k[len(prefix):]
            if "/" not in rest:
                continue
            run_tag = rest.split("/", 1)[0]
            if run_tag not in keep_run_keys:
                to_delete.append(k)
    # S3 delete in batches of 1000.
    for i in range(0, len(to_delete), 1000):
        batch = [{"Key": k} for k in to_delete[i:i+1000]]
        s3.delete_objects(Bucket=BUCKET, Delete={"Objects": batch, "Quiet": True})
    if to_delete:
        print(f"  [{model}] cleanup: deleted {len(to_delete)} old objects", flush=True)


def write_latest_manifest(s3, models_entries: dict[str, dict]) -> None:
    body = {
        "generatedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ingestVersion": EPS_INGEST_VERSION,
        "models": models_entries,
    }
    upload(s3, "radar/eps/latest.json",
           json.dumps(body).encode("utf-8"),
           "application/json", "public, max-age=60")
    print(f"manifest: radar/eps/latest.json written ({len(models_entries)} models)",
          flush=True)


def main() -> int:
    print(f"EPS INGEST START version={EPS_INGEST_VERSION} models={MODELS} "
          f"sha={os.environ.get('GITHUB_SHA','local')}", flush=True)
    if not BUCKET or not PUBLIC_URL:
        sys.exit("R2_BUCKET and R2_PUBLIC_URL must be set")
    s3 = make_s3()

    # Load previous manifest to preserve model entries we don't refresh this run
    # (e.g. CH2 ingest fails but CH1 succeeded — keep stale CH2 data).
    prev_entries: dict[str, dict] = {}
    try:
        obj = s3.get_object(Bucket=BUCKET, Key="radar/eps/latest.json")
        prev_entries = (json.loads(obj["Body"].read().decode("utf-8")) or {}).get("models", {}) or {}
    except Exception as exc:
        print(f"  no previous manifest ({exc!r})", flush=True)

    out_entries: dict[str, dict] = dict(prev_entries)

    for model in MODELS:
        print(f"== {model} ==", flush=True)
        try:
            found = find_latest_run(model)
            if not found:
                print(f"  [{model}] no run found, keep previous entry", flush=True)
                continue
            ref_time, items = found
            # Skip if we've already published this exact run AND it's
            # complete enough (>= MAX_HORIZON*0.9 steps in prev manifest).
            prev = prev_entries.get(model)
            run_iso = ref_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            if prev and prev.get("run") == run_iso:
                steps = prev.get("steps") or []
                if len(steps) >= int(MAX_HORIZON[model] * 0.9):
                    print(f"  [{model}] run {run_iso} already published "
                          f"with {len(steps)} steps — skip", flush=True)
                    continue
                print(f"  [{model}] run {run_iso} present but only "
                      f"{len(steps)} steps — re-process", flush=True)
            entry = process_model(s3, model, ref_time, items)
            if entry:
                out_entries[model] = entry
                # Cleanup older runs for this model.
                run_tag = ref_time.strftime("%Y%m%dT%H%M")
                # Keep current + (KEEP_RUNS-1) previous tags from previous manifest.
                keep_tags = {run_tag}
                if prev and prev.get("run"):
                    try:
                        prev_dt = datetime.fromisoformat(prev["run"].replace("Z", "+00:00"))
                        keep_tags.add(prev_dt.strftime("%Y%m%dT%H%M"))
                    except Exception:
                        pass
                cleanup_old_runs(s3, model, keep_tags)
        except Exception as exc:
            print(f"  [{model}] ERROR: {exc!r}", flush=True)

    if not out_entries:
        print("nothing to publish", flush=True)
        return 0
    write_latest_manifest(s3, out_entries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
