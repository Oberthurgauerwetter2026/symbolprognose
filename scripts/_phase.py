"""Niederschlagsphase (Regen / Schneeregen / Schnee) für Radar-PNGs.

Die Phase wird im Alpha-Kanal der PNGs kodiert, damit die RGB-Farben
weiterhin die Intensität (PRECIP_SCALE) tragen und das Frontend die mm/h
unverändert dekodieren kann:

  Alpha 245 / 255  → Regen   (Standard aus PRECIP_SCALE)
  Alpha 230        → Schneeregen (Schneeanteil 30–70 %)
  Alpha 215        → Schnee      (Schneeanteil ≥ 70 %)

MUSS mit PHASE_ALPHA in src/components/maps/radar-map.tsx übereinstimmen.
Ohne Phaseninfo bleibt das PNG reiner Regen (abwärtskompatibel).
"""
from __future__ import annotations

import numpy as np

ALPHA_SLEET = 230
ALPHA_SNOW = 215
SLEET_MIN = 0.3
SNOW_MIN = 0.7
# Open-Meteo `snowfall` ist cm Neuschnee; das Modell rechnet 1 mm Wasser
# ≈ 0.7 cm Schnee. Reiner Schneefall (1 mm → 0.7 cm) ergibt damit 100 %.
SNOW_CM_TO_MM = 1.0 / 0.7
# Temperatur-Gate (2 m): darüber physikalisch kein Schnee/Schneeregen.
T_RAIN_ONLY = 2.5
# Darunter reiner Schnee möglich; dazwischen höchstens Schneeregen.
T_SNOW_MAX = 1.0
# Schwache Ränder / Interpolationsreste nie als Mischphase einfärben.
P_MIN_MM = 0.1
S_MIN_CM = 0.05
# Standard-Temperaturgradient (°C pro m) unterhalb der Nullgradgrenze.
LAPSE = 0.0065
# Niederschlagsabkühlung: ab dieser Rate (mm/h) kühlt Schmelzen die Luft ab.
P_COOL_MIN = 2.0
P_COOL_PER_MM = 0.25
P_COOL_MAX = 1.2


def wet_bulb(temp_c, dew_c) -> np.ndarray:
    """Feuchtkugeltemperatur nach Stull (2011) aus T und Taupunkt (°C).
    Ohne Taupunkt bleibt T unverändert."""
    t = np.asarray(temp_c, dtype=np.float32)
    td = np.asarray(dew_c, dtype=np.float32)
    with np.errstate(all="ignore"):
        es = np.exp(17.625 * t / (243.04 + t))
        e = np.exp(17.625 * td / (243.04 + td))
        rh = np.clip(100.0 * e / es, 1.0, 100.0)
        tw = (
            t * np.arctan(0.151977 * np.sqrt(rh + 8.313659))
            + np.arctan(t + rh) - np.arctan(rh - 1.676331)
            + 0.00391838 * rh ** 1.5 * np.arctan(0.023101 * rh)
            - 4.686035
        )
    tw = np.minimum(tw, t)  # Feuchtkugel nie wärmer als Luft
    return np.where(np.isfinite(tw), tw, t).astype(np.float32)


def phase_temp(temp_c, dew_c=None, fzl_m=None, elev_m=None, precip_mmh=None) -> np.ndarray:
    """Effektive Phasentemperatur pro Modellpunkt, wie bei Wetterdiensten:
    1) Feuchtkugeltemperatur (Verdunstungskälte bei trockener Luft),
    2) Nullgradgrenze relativ zur Geländehöhe (Schmelzschicht),
    3) Niederschlagsabkühlung bei kräftigem Niederschlag.
    Fehlende Grössen werden übersprungen (Fallback: 2-m-Temperatur)."""
    t = np.asarray(temp_c, dtype=np.float32)
    eff = t.copy()
    if dew_c is not None:
        td = np.asarray(dew_c, dtype=np.float32)
        if td.shape == t.shape:
            ok = np.isfinite(td) & np.isfinite(t)
            eff = np.where(ok, wet_bulb(t, np.where(ok, td, t)), eff)
    if fzl_m is not None and elev_m is not None:
        fz = np.asarray(fzl_m, dtype=np.float32)
        el = np.broadcast_to(np.asarray(elev_m, dtype=np.float32), t.shape)
        if fz.shape == t.shape:
            ok = np.isfinite(fz) & np.isfinite(el)
            t_fzl = (fz - el) * LAPSE  # Temperatur aus Abstand zur 0-°C-Höhe
            # Nur verschärfen (kälter), nie wärmer machen als die Messung.
            eff = np.where(ok & np.isfinite(eff), np.minimum(eff, np.maximum(t_fzl, eff - 2.0)), eff)
    if precip_mmh is not None:
        p = np.asarray(precip_mmh, dtype=np.float32)
        if p.shape == t.shape:
            cool = np.clip((np.nan_to_num(p) - P_COOL_MIN) * P_COOL_PER_MM, 0.0, P_COOL_MAX)
            eff = np.where(eff < 4.0, eff - cool, eff)
    return eff.astype(np.float32)


def snow_fraction(
    precip_mm: np.ndarray,
    snow_cm: np.ndarray,
    temp_c: np.ndarray | None = None,
) -> np.ndarray:
    """Schneeanteil 0..1 aus Niederschlag (mm), Schneefall (cm) und optional
    2-m-Temperatur (°C). Über T_RAIN_ONLY immer 0 (Regen)."""
    p = np.asarray(precip_mm, dtype=np.float32)
    s_cm = np.asarray(snow_cm, dtype=np.float32)
    s = s_cm * SNOW_CM_TO_MM
    with np.errstate(invalid="ignore", divide="ignore"):
        f = np.where((p >= P_MIN_MM) & (s_cm >= S_MIN_CM), s / np.maximum(p, 1e-6), 0.0)
    f = np.clip(np.nan_to_num(f, nan=0.0), 0.0, 1.0).astype(np.float32)
    if temp_c is not None:
        t = np.asarray(temp_c, dtype=np.float32)
        if t.shape == f.shape:
            warm = np.isfinite(t) & (t > T_RAIN_ONLY)
            f[warm] = 0.0
            mild = np.isfinite(t) & (t > T_SNOW_MAX) & (t <= T_RAIN_ONLY)
            # Schmelzzone: höchstens Schneeregen.
            f[mild] = np.minimum(f[mild], SNOW_MIN - 0.01)
    return f


def point_fraction(
    precip_mm: np.ndarray,
    snow_cm: np.ndarray,
    temp_c: np.ndarray,
) -> np.ndarray:
    """Schneeanteil pro Modellpunkt (vor jeder Interpolation).
    Mit Modellniederschlag: Verhältnis Schnee/Niederschlag + Temperatur-Gate.
    Ohne Modellniederschlag (Radar misst trotzdem etwas): Phase allein aus der
    Temperatur — ≤1 °C Schnee, 1–2.5 °C Schneeregen, sonst Regen.
    Ohne Temperatur: nur das punkteigene Schnee/Niederschlag-Verhältnis."""
    p = np.asarray(precip_mm, dtype=np.float32)
    t = np.asarray(temp_c, dtype=np.float32)
    f = snow_fraction(p, snow_cm, t)
    dry = ~(p >= P_MIN_MM)
    by_t = np.where(t <= T_SNOW_MAX, 1.0, np.where(t <= T_RAIN_ONLY, 0.5, 0.0))
    f = np.where(dry & np.isfinite(t), by_t, f)
    # Ohne Temperatur: Verhältnis Schnee/Niederschlag des Punkts selbst
    # (warme Punkte haben dort 0 cm Schnee → Regen).
    return np.clip(f, 0.0, 1.0).astype(np.float32)


def apply_phase_alpha(rgba: np.ndarray, frac: np.ndarray | None) -> np.ndarray:
    """Setzt die Phasen-Alphacodes auf allen gefärbten Pixeln."""
    if frac is None or frac.shape != rgba.shape[:2]:
        return rgba
    wet = rgba[..., 3] > 0
    f = np.nan_to_num(frac, nan=0.0)
    rgba[wet & (f >= SNOW_MIN), 3] = ALPHA_SNOW
    rgba[wet & (f >= SLEET_MIN) & (f < SNOW_MIN), 3] = ALPHA_SLEET
    return rgba


def idw_to_grid(
    pt_lat: np.ndarray,
    pt_lon: np.ndarray,
    pt_vals: np.ndarray,
    grid_lat: np.ndarray,
    grid_lon: np.ndarray,
    k: int = 6,
) -> np.ndarray:
    """Glatte Inverse-Distanz-Interpolation (k nächste Punkte, Potenz 2).
    Bewusst nicht Nearest-Neighbour, damit Phasengrenzen nie blockig sind."""
    gl = grid_lat.ravel().astype(np.float32)
    go = grid_lon.ravel().astype(np.float32)
    plat = pt_lat.astype(np.float32)
    plon = pt_lon.astype(np.float32)
    coslat = np.float32(np.cos(np.deg2rad(float(np.mean(plat)))))
    out = np.zeros(gl.size, dtype=np.float32)
    k = max(1, min(k, plat.size))
    chunk = 2048
    for i in range(0, gl.size, chunk):
        dy = gl[i:i + chunk, None] - plat[None, :]
        dx = (go[i:i + chunk, None] - plon[None, :]) * coslat
        d2 = dy * dy + dx * dx
        idx = np.argpartition(d2, k - 1, axis=1)[:, :k]
        dk = np.take_along_axis(d2, idx, axis=1)
        w = 1.0 / np.maximum(dk, 1e-8)
        vk = pt_vals[idx]
        out[i:i + chunk] = (w * vk).sum(axis=1) / w.sum(axis=1)
    return out.reshape(grid_lat.shape)
