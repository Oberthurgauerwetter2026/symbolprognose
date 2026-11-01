"""Zugrichtungs-Leitplanke: Radar-Vektor mit der 700-hPa-Steuerungsströmung koppeln.

Pure Funktionen (getestet in test_motion_estimate.py). Die Geschwindigkeit
stammt immer aus dem Radar; die Steuerungsströmung korrigiert nur die
Richtung, und zwar umso stärker, je schwächer/unsicherer das Radarsignal ist.
"""
from __future__ import annotations

import math


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def radar_weight(kmh: float, quality: float) -> float:
    """Vertrauen in die Radarrichtung (0.2–1)."""
    w = _clamp((quality - 0.35) / 0.4) * _clamp(kmh / 20.0)
    if kmh < 15.0:
        w = min(w, 0.25)  # langsamer Zug: Richtung zu mind. 75 % aus dem Höhenwind
    return max(0.15, w)


def blend_steering(model: tuple | None, saentis: tuple | None, saentis_weight: float = 0.4) -> tuple:
    """700-hPa-Modellwind und Säntis-Messwind (Herkunft °, km/h) vektoriell mischen.

    Fehlt eine Quelle, gilt die andere allein; schwacher Säntiswind (<5 km/h,
    meist Lee/Inversion) wird ignoriert.
    """
    srcs = []
    if model and model[0] is not None and model[1]:
        srcs.append((model[0], model[1], 1.0 - saentis_weight))
    if saentis and saentis[0] is not None and saentis[1] and saentis[1] >= 5.0:
        srcs.append((saentis[0], saentis[1], saentis_weight))
    if not srcs:
        return None, None
    tw = sum(w for *_, w in srcs)
    x = sum(w * k * math.sin(math.radians(d)) for d, k, w in srcs) / tw
    y = sum(w * k * math.cos(math.radians(d)) for d, k, w in srcs) / tw
    kmh = math.hypot(x, y)
    if kmh < 1e-6:
        return None, None
    return round((math.degrees(math.atan2(x, y)) + 360.0) % 360.0, 1), round(kmh, 1)


def nudge_motion(motion: dict | None, steer_from_deg: float | None, steer_kmh: float | None) -> dict | None:
    if motion is None or steer_from_deg is None or not steer_kmh or steer_kmh < 5.0:
        return motion
    kmh = float(motion["kmh"])
    if kmh <= 0.0:
        return motion  # stationärer Stauregen bleibt stehen, Richtung egal
    w = radar_weight(kmh, float(motion.get("quality", 0.0)))
    r = math.radians(float(motion["dirFromDeg"]))
    s = math.radians(float(steer_from_deg))
    x = w * math.sin(r) + (1 - w) * math.sin(s)
    y = w * math.cos(r) + (1 - w) * math.cos(s)
    if math.hypot(x, y) < 1e-6:
        return motion
    out = dict(motion)
    out["dirFromDeg"] = round((math.degrees(math.atan2(x, y)) + 360.0) % 360.0, 1)
    out["radarDirFromDeg"] = motion["dirFromDeg"]
    out["steerWeight"] = round(1 - w, 2)
    return out
