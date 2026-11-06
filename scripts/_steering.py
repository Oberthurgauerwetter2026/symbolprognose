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
    if quality >= 0.6 and kmh >= 3.0:
        return 1.0  # klares Mustersignal: die Messung gilt, kein Modell-Nudging
    w = _clamp((quality - 0.35) / 0.4) * _clamp(kmh / 20.0)
    if kmh < 15.0:
        w = min(w, 0.25)  # langsamer Zug: Richtung zu mind. 75 % aus dem Höhenwind
    return max(0.15, w)


def layer_wind(w850: tuple | None, w700: tuple | None, w850_weight: float = 0.65) -> tuple | None:
    """Steuerungsschicht 850/700 hPa vektoriell mitteln (850 hPa dominiert,
    weil Mittelland-Niederschlag in ~1500 m zieht; 700 hPa allein ist föhnanfällig)."""
    srcs = []
    for w, wt in ((w850, w850_weight), (w700, 1.0 - w850_weight)):
        if w and w[0] is not None and w[1]:
            srcs.append((float(w[0]), float(w[1]), wt))
    if not srcs:
        return None
    tw = sum(w for *_, w in srcs)
    x = sum(w * k * math.sin(math.radians(d)) for d, k, w in srcs) / tw
    y = sum(w * k * math.cos(math.radians(d)) for d, k, w in srcs) / tw
    if math.hypot(x, y) < 1e-6:
        return None
    return round((math.degrees(math.atan2(x, y)) + 360.0) % 360.0, 1), round(math.hypot(x, y), 1)


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


def _ang_diff(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def centroid_track(points: list[tuple[float, float, float]], min_km: float = 3.0) -> tuple | None:
    """Reale Schwerpunkt-Wanderung aus (t_min, x_km Ost, y_km Nord).

    Gibt (Herkunft °, km/h, Konsistenz 0–1) zurück oder None, wenn die
    Verlagerung zu klein bzw. die Einzelschritte widersprüchlich sind.
    """
    if len(points) < 3:
        return None
    pts = sorted(points)
    dx = pts[-1][1] - pts[0][1]
    dy = pts[-1][2] - pts[0][2]
    dt = pts[-1][0] - pts[0][0]
    dist = math.hypot(dx, dy)
    if dt <= 0 or dist < min_km:
        return None
    steps = [(b[1] - a[1], b[2] - a[2]) for a, b in zip(pts, pts[1:])]
    path = sum(math.hypot(x, y) for x, y in steps)
    consistency = dist / path if path > 0 else 0.0
    if consistency < 0.5:
        return None
    to_deg = math.degrees(math.atan2(dx, dy))
    return round((to_deg + 180.0) % 360.0, 1), round(dist / (dt / 60.0), 1), round(consistency, 2)


def guard_direction(motion: dict | None, track: tuple | None, max_dev: float = 90.0,
                    steering_dir: float | None = None) -> dict | None:
    """Richtungs-Sperre: der Nowcast darf nie entgegen der gemessenen Wanderung laufen.

    Weicht der (genudgte) Vektor mehr als `max_dev` von der Schwerpunkt-
    Wanderung ab, gilt die gemessene Richtung; bei kleinerer Abweichung bleibt
    der Vektor, wird aber auf höchstens `max_dev/2` an die Messung gezogen.
    """
    if motion is None or track is None or float(motion.get("kmh", 0.0)) <= 0.0:
        return motion
    tdir = float(track[0])
    # Schwerpunkte täuschen bei mehreren Feldern / Rand-Wachstum Bewegung vor:
    # nur überstimmen, wenn die Wanderung zum Höhenwind passt.
    if steering_dir is not None and _ang_diff(tdir, float(steering_dir)) > 60.0:
        return motion
    cur = float(motion["dirFromDeg"])
    dev = _ang_diff(cur, tdir)
    limit = max_dev / 2.0
    if dev <= limit:
        return motion
    out = dict(motion)
    if dev > max_dev:
        new = tdir
    else:
        sign = 1.0 if ((cur - tdir + 180.0) % 360.0 - 180.0) > 0 else -1.0
        new = (tdir + sign * limit) % 360.0
    out["dirFromDeg"] = round(new, 1)
    out["trackDirFromDeg"] = tdir
    out["guarded"] = True
    return out
