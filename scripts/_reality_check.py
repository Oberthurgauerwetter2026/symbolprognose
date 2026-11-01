"""Realitätsabgleich Modell ↔ Radar (pure, getestet).

Ist das Radar im Zuströmbereich eines Modellpunkts trocken, rechnet das Modell
dort aber Niederschlag, wird dieser Modellniederschlag für die ersten
Prognosestunden gedämpft. Nasses Radar oder fehlende Radarabdeckung lassen das
Modell unverändert — wir dämpfen nur, was die Messung klar widerlegt.
"""
from __future__ import annotations

import math

import numpy as np

WET_MMH = 0.1
POOL = 4  # 420×200 → 105×50
MAX_LEAD_H = 3.0
MAX_OBS_AGE_MIN = 45.0
# Restanteil des Modellregens bei klar trockenem Radar je Vorlaufzeit.
FLOOR_BY_LEAD = ((0.0, 0.3), (1.0, 0.3), (2.0, 0.6), (3.0, 1.0))


def wet_grid(precip: np.ndarray, pool: int = POOL) -> np.ndarray:
    """Max-gepooltes Nass-Raster: 1 = nass, 0 = trocken, 2 = keine Abdeckung.
    Zeile 0 = Norden (wie das Radarbild)."""
    h, w = precip.shape
    gh, gw = h // pool, w // pool
    blk = precip[: gh * pool, : gw * pool].reshape(gh, pool, gw, pool)
    nan = np.isnan(blk).all(axis=(1, 3))
    wet = (np.nan_to_num(blk, nan=0.0) >= WET_MMH).any(axis=(1, 3))
    out = wet.astype(np.uint8)
    out[nan & ~wet] = 2
    return out


def encode(grid: np.ndarray) -> list[str]:
    return ["".join(str(int(v)) for v in row) for row in grid]


def decode(rows: list[str]) -> np.ndarray:
    return np.array([[int(c) for c in r] for r in rows], dtype=np.uint8)


def residual_factor(lead_h: float) -> float:
    if lead_h <= 0 or lead_h >= MAX_LEAD_H:
        return 1.0
    pts = FLOOR_BY_LEAD
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= lead_h <= x1:
            return y0 + (y1 - y0) * (lead_h - x0) / (x1 - x0)
    return 1.0


def damping_factors(
    lats, lons, lead_h: float, grid: np.ndarray, bbox: dict, motion: dict | None,
) -> np.ndarray:
    """Faktor je Modellpunkt (Zeilen = lats aufsteigend, Spalten = lons)."""
    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)
    out = np.ones((lats.size, lons.size), dtype=np.float32)
    floor = residual_factor(lead_h)
    if floor >= 1.0:
        return out

    gh, gw = grid.shape
    deg_lat = (bbox["maxLat"] - bbox["minLat"]) / gh
    deg_lon = (bbox["maxLon"] - bbox["minLon"]) / gw
    lat_mid = 0.5 * (bbox["maxLat"] + bbox["minLat"])
    km_lat = deg_lat * 111.2
    km_lon = deg_lon * 111.2 * math.cos(math.radians(lat_mid))

    # Zuströmpunkt: gegen die Zugrichtung (= Herkunftsrichtung) zurückgehen.
    up_km_e = up_km_n = 0.0
    if motion and isinstance(motion.get("kmh"), (int, float)):
        d = float(motion.get("kmh", 0.0)) * lead_h
        a = math.radians(float(motion.get("dirFromDeg", 0.0)))
        up_km_e, up_km_n = d * math.sin(a), d * math.cos(a)
    # Unsicherheit wächst mit der Vorlaufzeit.
    radius_km = 12.0 + 15.0 * lead_h
    rr = max(1, int(math.ceil(radius_km / km_lat)))
    rc = max(1, int(math.ceil(radius_km / km_lon)))

    wet = (grid != 0).astype(np.int32)  # nass oder unbekannt → nicht dämpfen
    integ = np.pad(wet.cumsum(0).cumsum(1), ((1, 0), (1, 0)))

    for i, la in enumerate(lats):
        r = (bbox["maxLat"] - (la + up_km_n / 111.2)) / deg_lat
        for j, lo in enumerate(lons):
            c = (lo + up_km_e / (111.2 * math.cos(math.radians(la))) - bbox["minLon"]) / deg_lon
            ri, ci = int(r), int(c)
            if ri < 0 or ri >= gh or ci < 0 or ci >= gw:
                continue  # Zuströmbereich ausserhalb Radar → keine Aussage
            r0, r1 = max(0, ri - rr), min(gh, ri + rr + 1)
            c0, c1 = max(0, ci - rc), min(gw, ci + rc + 1)
            n = integ[r1, c1] - integ[r0, c1] - integ[r1, c0] + integ[r0, c0]
            if n == 0:
                out[i, j] = floor
    return out
