"""Lokales Verlagerungsfeld (Stufe 2) und semi-Lagrange-Advektion.

Statt eines einzigen Zugvektors für die ganze Karte bekommt jede Gegend einen
eigenen Vektor aus Block-Matching zweier ~15 Minuten auseinanderliegender
Radarbilder. Blöcke ohne klares Signal übernehmen den globalen Vektor, damit
nichts erfunden wird; das Feld wird geglättet und in der Abweichung begrenzt.
Reine Funktionen, getestet in test_local_flow.py.
"""
from __future__ import annotations

import math
import numpy as np

BLOCK = 32          # Blockgrösse in Pixeln
STRIDE = 16         # Schrittweite der Blockmitten
SEARCH = 8          # Suchradius um den globalen Vektor (Pixel pro Bildpaar)
MIN_WET = 0.15      # Mindestanteil nasser Pixel im Block
MIN_SCORE = 0.5     # Mindest-Korrelation für einen lokalen Vektor
MAX_DEV = 1.5       # maximale Abweichung vom globalen Vektor (× |global| + SEARCH/2)


def _prep(a: np.ndarray) -> np.ndarray:
    a = np.nan_to_num(a, nan=0.0)
    return np.where(a >= 0.3, np.sqrt(a), 0.0).astype(np.float32)


def block_vectors(prev: np.ndarray, cur: np.ndarray, gdx: float, gdy: float):
    """Grobes Vektorfeld (Pixel pro Bildpaar) auf dem Blockgitter.

    Gibt (centers_y, centers_x, U, V, ok) zurück; ok markiert Blöcke mit
    eigenem Messsignal, alle anderen tragen den globalen Vektor.
    """
    a, b = _prep(prev), _prep(cur)
    h, w = b.shape
    cy = np.arange(BLOCK // 2, h - BLOCK // 2 + 1, STRIDE)
    cx = np.arange(BLOCK // 2, w - BLOCK // 2 + 1, STRIDE)
    U = np.full((len(cy), len(cx)), float(gdx))
    V = np.full((len(cy), len(cx)), float(gdy))
    ok = np.zeros((len(cy), len(cx)), dtype=bool)
    r = BLOCK // 2
    g0x, g0y = int(round(gdx)), int(round(gdy))
    for j, y in enumerate(cy):
        for i, x in enumerate(cx):
            core = b[y - r:y + r, x - r:x + r]
            if np.count_nonzero(core) < MIN_WET * core.size:
                continue
            nb = float(np.linalg.norm(core))
            best, bx, by = -1.0, 0, 0
            for dy in range(g0y - SEARCH, g0y + SEARCH + 1):
                y0 = y - r - dy
                if y0 < 0 or y0 + BLOCK > h:
                    continue
                for dx in range(g0x - SEARCH, g0x + SEARCH + 1):
                    x0 = x - r - dx
                    if x0 < 0 or x0 + BLOCK > w:
                        continue
                    sub = a[y0:y0 + BLOCK, x0:x0 + BLOCK]
                    na = float(np.linalg.norm(sub))
                    if na <= 0:
                        continue
                    s = float((sub * core).sum()) / (na * nb)
                    if s > best:
                        best, bx, by = s, dx, dy
            if best >= MIN_SCORE:
                U[j, i], V[j, i], ok[j, i] = bx, by, True
    return cy, cx, U, V, ok


def smooth_limit(U, V, ok, gdx: float, gdy: float):
    """3×3-Median über gültige Blöcke, dann Abweichung vom globalen Vektor begrenzen."""
    Us, Vs = U.copy(), V.copy()
    nj, ni = U.shape
    for j in range(nj):
        for i in range(ni):
            sl = (slice(max(0, j - 1), j + 2), slice(max(0, i - 1), i + 2))
            m = ok[sl]
            if m.sum() >= 2:
                Us[j, i] = float(np.median(U[sl][m]))
                Vs[j, i] = float(np.median(V[sl][m]))
            elif not ok[j, i]:
                Us[j, i], Vs[j, i] = gdx, gdy
    lim = MAX_DEV * math.hypot(gdx, gdy) + SEARCH / 2
    ddx, ddy = Us - gdx, Vs - gdy
    d = np.hypot(ddx, ddy)
    k = np.where(d > lim, lim / np.maximum(d, 1e-9), 1.0)
    return gdx + ddx * k, gdy + ddy * k


def dense_field(shape, cy, cx, U, V):
    """Bilinear auf volle Auflösung interpolieren (Ränder konstant)."""
    h, w = shape
    yy, xx = np.arange(h, dtype=float), np.arange(w, dtype=float)

    def interp(G):
        rows = np.array([np.interp(xx, cx, G[j]) for j in range(G.shape[0])])
        return np.array([np.interp(yy, cy, rows[:, x]) for x in range(w)]).T

    return interp(U), interp(V)


def local_flow(prev, cur, minutes: float, gdx: float, gdy: float):
    """Pixel-Vektorfeld in Pixeln pro Minute; None ohne lokale Evidenz."""
    if prev.shape != cur.shape or minutes <= 0:
        return None
    cy, cx, U, V, ok = block_vectors(prev, cur, gdx, gdy)
    if len(cy) < 2 or len(cx) < 2 or not ok.any():
        return None
    U, V = smooth_limit(U, V, ok, gdx, gdy)
    u, v = dense_field(cur.shape, cy, cx, U, V)
    return u / minutes, v / minutes


def _sample(field, x, y):
    h, w = field.shape
    valid = (x >= 0) & (x <= w - 1) & (y >= 0) & (y <= h - 1)
    x = np.clip(x, 0, w - 1); y = np.clip(y, 0, h - 1)
    x0, y0 = x.astype(int), y.astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    tx, ty = x - x0, y - y0
    out = (field[y0, x0] * (1 - tx) * (1 - ty) + field[y0, x1] * tx * (1 - ty)
           + field[y1, x0] * (1 - tx) * ty + field[y1, x1] * tx * ty)
    return np.where(valid, out, 0.0)


def advect(field: np.ndarray, u: np.ndarray, v: np.ndarray, lead_min: float,
           substep_min: float = 5.0) -> np.ndarray:
    """Semi-Lagrange rückwärts: Rückverfolgung der Trajektorie in Teilschritten."""
    h, w = field.shape
    y, x = np.indices((h, w), dtype=float)
    n = max(1, int(math.ceil(lead_min / substep_min)))
    dt = lead_min / n
    for _ in range(n):
        x = x - _sample(u, x, y) * dt
        y = y - _sample(v, x, y) * dt
    return _sample(np.nan_to_num(field, nan=0.0), x, y)


def advect_with_inflow(field: np.ndarray, wide: np.ndarray, u: np.ndarray, v: np.ndarray,
                       lead_min: float, pad: int, fade_px: int = 25) -> np.ndarray:
    """Advektiert auf einem um `pad` erweiterten Messfeld und schneidet erst danach zu.

    `field` (entwickelte Intensität im Kartenausschnitt) ersetzt das Zentrum von
    `wide`; der Rand liefert real gemessenen Einstrom statt eines leeren Vakuums.
    Der äusserste Rand wird weich ausgeblendet, damit nie eine Linealkante entsteht.
    """
    h, w = field.shape
    big = np.nan_to_num(wide, nan=0.0).astype(float, copy=True)
    big[pad:pad + h, pad:pad + w] = np.nan_to_num(field, nan=0.0)
    gh, gw = big.shape
    yy, xx = np.indices((gh, gw))
    edge = np.minimum.reduce([xx, yy, gw - 1 - xx, gh - 1 - yy]).astype(float)
    big *= np.clip(edge / max(1, fade_px), 0.0, 1.0)
    bu = np.pad(u, pad, mode="edge")
    bv = np.pad(v, pad, mode="edge")
    out = advect(big, bu, bv, lead_min)
    return out[pad:pad + h, pad:pad + w]
