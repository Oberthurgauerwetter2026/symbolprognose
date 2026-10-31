"""Niederschlagsphase (Regen / Schneeregen / Schnee) für Radar-PNGs.

Die Phase wird im Alpha-Kanal der PNGs kodiert, damit die RGB-Farben
weiterhin die Intensität (PRECIP_SCALE) tragen und das Frontend die mm/h
unverändert dekodieren kann:

  Alpha 245 / 255  → Regen   (Standard aus PRECIP_SCALE)
  Alpha 230        → Schneeregen (Schneeanteil 30–70 %)
  Alpha 215        → Schnee      (Schneeanteil ≥ 70 %)
  Alpha 200        → Gefrierender Regen (flüssig auf gefrorenen Boden)

MUSS mit PHASE_ALPHA in src/components/maps/radar-map.tsx übereinstimmen.
Ohne Phaseninfo bleibt das PNG reiner Regen (abwärtskompatibel).
"""
from __future__ import annotations

import numpy as np

ALPHA_SLEET = 230
ALPHA_SNOW = 215
ALPHA_FZRA = 200
# Gefrierender Regen: Boden ≤ 0 °C, aber warme Schicht darüber (Nullgrad-
# grenze deutlich über Grund) und Modell rechnet (fast) keinen Schnee.
FZRA_T_MAX = 0.0
FZRA_WARM_NOSE_M = 300.0
FZRA_SNOW_MAX = 0.3
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
    # Mit Feuchtkugel-/Phasentemperatur: klar kalte Punkte mindestens als
    # Schnee bzw. Schneeregen, auch wenn das Modell weniger Schnee rechnet.
    floor = np.where(t <= 0.5, 1.0, np.where(t <= 1.5, 0.5, 0.0))
    f = np.where(np.isfinite(t), np.maximum(f, floor), f)
    # Ohne Temperatur: Verhältnis Schnee/Niederschlag des Punkts selbst
    # (warme Punkte haben dort 0 cm Schnee → Regen).
    return np.clip(f, 0.0, 1.0).astype(np.float32)


def freezing_rain_point(precip_mm, snow_cm, temp2m_c, fzl_m, elev_m) -> np.ndarray:
    """0/1 pro Modellpunkt: gefrierender Regen.

    Bedingungen (alle): rohe 2-m-Temperatur ≤ 0 °C, Nullgradgrenze mind.
    FZRA_WARM_NOSE_M über Grund (warme Schicht oben → Tropfen schmelzen),
    Modell-Schneeanteil < FZRA_SNOW_MAX. Niederschlagsmenge wird hier nicht
    verlangt, weil das Radar die Fläche liefert; fehlende Grössen → 0."""
    t = np.asarray(temp2m_c, dtype=np.float32)
    fz = np.asarray(fzl_m, dtype=np.float32)
    el = np.broadcast_to(np.asarray(elev_m, dtype=np.float32), t.shape)
    p = np.nan_to_num(np.asarray(precip_mm, dtype=np.float32))
    s = np.nan_to_num(np.asarray(snow_cm, dtype=np.float32)) * SNOW_CM_TO_MM
    if fz.shape != t.shape:
        return np.zeros(t.shape, dtype=np.float32)
    with np.errstate(all="ignore"):
        ratio = np.where(p >= P_MIN_MM, s / np.maximum(p, 1e-6), 0.0)
        ok = (
            np.isfinite(t) & np.isfinite(fz) & np.isfinite(el)
            & (t <= FZRA_T_MAX)
            & ((fz - el) >= FZRA_WARM_NOSE_M)
            & (ratio < FZRA_SNOW_MAX)
        )
    return ok.astype(np.float32)


def apply_phase_alpha(
    rgba: np.ndarray, frac: np.ndarray | None, fzra: np.ndarray | None = None,
) -> np.ndarray:
    """Setzt die Phasen-Alphacodes auf allen gefärbten Pixeln. `fzra` (0..1,
    geglättet) überschreibt ab 0.5 als gefrierender Regen."""
    wet = rgba[..., 3] > 0
    if frac is not None and frac.shape == rgba.shape[:2]:
        f = np.nan_to_num(frac, nan=0.0)
        rgba[wet & (f >= SNOW_MIN), 3] = ALPHA_SNOW
        rgba[wet & (f >= SLEET_MIN) & (f < SNOW_MIN), 3] = ALPHA_SLEET
    if fzra is not None and fzra.shape == rgba.shape[:2]:
        rgba[wet & (np.nan_to_num(fzra) >= 0.5), 3] = ALPHA_FZRA
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


# ---------------------------------------------------------------------------
# Relief-Verfeinerung: Phase pro Kartenpixel nach realer Geländehöhe.
# ---------------------------------------------------------------------------
_DEM_CACHE: dict = {}


def load_dem(shape: tuple[int, int]) -> np.ndarray | None:
    """Reales Höhenmodell (m) im Kartenraster (Basel–Tirol, 420×200)."""
    if shape in _DEM_CACHE:
        return _DEM_CACHE[shape]
    import os
    path = os.path.join(os.path.dirname(__file__), "terrain_elev_420x200.npy")
    dem = None
    try:
        d = np.load(path).astype(np.float32)
        if d.shape == shape:
            dem = d
    except Exception:  # noqa: BLE001
        dem = None
    _DEM_CACHE[shape] = dem
    return dem


def terrain_temp(t_model, elev_model, dem) -> np.ndarray:
    """Phasentemperatur auf die echte Pixelhöhe umgerechnet: Gipfel kälter,
    Täler wärmer als der geglättete Modellberg (0.65 °C / 100 m)."""
    t = np.asarray(t_model, dtype=np.float32)
    dz = np.asarray(elev_model, dtype=np.float32) - np.asarray(dem, dtype=np.float32)
    dz = np.clip(np.nan_to_num(dz), -1500.0, 1500.0)
    return (t + dz * LAPSE).astype(np.float32)


def terrain_fraction(frac, t_pix) -> np.ndarray:
    """Schneeanteil an die Pixeltemperatur anpassen: über 2.5 °C Regen,
    1–2.5 °C höchstens Schneeregen, ≤1.5 °C mind. Schneeregen, ≤0.5 °C Schnee."""
    f = np.asarray(frac, dtype=np.float32).copy()
    t = np.asarray(t_pix, dtype=np.float32)
    ok = np.isfinite(t)
    f[ok & (t > T_RAIN_ONLY)] = 0.0
    mild = ok & (t > T_SNOW_MAX) & (t <= T_RAIN_ONLY)
    f[mild] = np.minimum(f[mild], SNOW_MIN - 0.01)
    f[ok & (t <= 1.5)] = np.maximum(f[ok & (t <= 1.5)], 0.5)
    f[ok & (t <= 0.5)] = 1.0
    return np.clip(f, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Messwert-Korrektur: Boden- und Höhenstationen (Pseudo-Sondierung).
# ---------------------------------------------------------------------------
# Unterhalb dieser Höhe gilt eine Station als Bodenstation (2-m-Feld).
OBS_GROUND_MAX_M = 900.0
# Ab dieser Höhe gilt eine Station als Höhenstation (Warmnasen-Check).
OBS_ALOFT_MIN_M = 700.0
OBS_RADIUS_KM = 15.0
OBS_DZ_M = 300.0
OBS_RESID_MAX = 5.0
# Warmnase gilt als gemessen ab dieser Höhenstations-Temperatur.
OBS_WARM_C = 0.5
OBS_COLD_C = -0.5


def _km(lat1, lon1, lat2, lon2):
    coslat = np.cos(np.deg2rad(47.5))
    return np.hypot((lat1 - lat2) * 111.0, (lon1 - lon2) * 111.0 * coslat)


def station_correct(m_lat, m_lon, m_el, m_val, obs) -> np.ndarray:
    """Korrigiert ein bodennahes Modellfeld (2-m-Temperatur oder Taupunkt) mit
    Stationsmessungen. `obs` = Liste (lat, lon, alt, wert). Pro Station wird
    das Residuum Messung − Modell (höhenkorrigiert) bestimmt und mit Distanz-
    und Höhengewicht auf nahe, tiefe Modellpunkte verteilt. Weit weg bleibt
    das Modell unverändert; Höhenpunkte (>900 m) werden nie verändert."""
    v = np.asarray(m_val, dtype=np.float32).copy()
    lat = np.asarray(m_lat, dtype=np.float32)
    lon = np.asarray(m_lon, dtype=np.float32)
    el = np.asarray(m_el, dtype=np.float32)
    ok = np.isfinite(v) & np.isfinite(el)
    if not ok.any():
        return v
    num = np.zeros_like(v)
    den = np.zeros_like(v)
    for s_lat, s_lon, s_alt, s_val in obs:
        if s_val is None or not np.isfinite(s_val) or s_alt > OBS_GROUND_MAX_M:
            continue
        d = _km(lat, lon, s_lat, s_lon)
        near = ok & (d < 3 * OBS_RADIUS_KM)
        if near.sum() == 0:
            continue
        idx = np.argsort(np.where(near, d, np.inf))[:4]
        idx = idx[near[idx]]
        w = 1.0 / np.maximum(d[idx], 0.5) ** 2
        model_at = float(((v[idx] + (el[idx] - s_alt) * LAPSE) * w).sum() / w.sum())
        r = float(np.clip(s_val - model_at, -OBS_RESID_MAX, OBS_RESID_MAX))
        wt = np.exp(-(d / OBS_RADIUS_KM) ** 2) * np.exp(-((el - s_alt) / OBS_DZ_M) ** 2)
        wt = np.where(ok & (el <= OBS_GROUND_MAX_M), wt, 0.0)
        num += wt * r
        den += wt
    # +0.3: Einzelstation am Rand wirkt nur teilweise (sanfter Übergang).
    return (v + num / (den + 0.3)).astype(np.float32)


def observed_freezing_level(m_el, m_fzl, obs) -> np.ndarray:
    """Nullgradgrenze mit Höhenstationen (Hörnli, Säntis, …) abgleichen.
    Misst eine Höhenstation > +0.5 °C, liegt die 0-°C-Grenze mindestens dort
    (+ T/Gradient) → gemessene Warmnase. Messen alle Höhenstationen < −0.5 °C,
    gibt es unterhalb der höchsten keine Warmschicht → Nullgradgrenze höchstens
    knapp über Grund (Schnee statt Glatteis)."""
    fz = np.asarray(m_fzl, dtype=np.float32).copy()
    el = np.broadcast_to(np.asarray(m_el, dtype=np.float32), fz.shape)
    aloft = [(a, t) for _la, _lo, a, t in obs
             if a >= OBS_ALOFT_MIN_M and t is not None and np.isfinite(t)]
    if not aloft:
        return fz
    warm = [a + t / LAPSE for a, t in aloft if t > OBS_WARM_C]
    if warm:
        h = float(max(warm))
        return np.where(np.isfinite(fz), np.maximum(fz, h), h).astype(np.float32)
    if all(t < OBS_COLD_C for _a, t in aloft) and max(a for a, _t in aloft) >= 2000:
        cap = el + 100.0
        return np.where(np.isfinite(fz), np.minimum(fz, cap), fz).astype(np.float32)
    return fz
