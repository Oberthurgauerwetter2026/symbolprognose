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
    return max(0.2, w)


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
