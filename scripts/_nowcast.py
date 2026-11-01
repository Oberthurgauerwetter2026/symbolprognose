"""Conservative radar intensity tendency; no stretching or invented cells."""
from __future__ import annotations

import math
import numpy as np


def aligned_previous(previous: np.ndarray, dx: float, dy: float) -> np.ndarray:
    """Sample the previous field at current coordinates; outside stays unknown."""
    h, w = previous.shape
    y, x = np.indices((h, w), dtype=float)
    x -= dx
    y -= dy
    valid = (x >= 0) & (x <= w - 1) & (y >= 0) & (y <= h - 1)
    x = np.clip(x, 0, w - 1)
    y = np.clip(y, 0, h - 1)
    x0, y0 = x.astype(int), y.astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    tx, ty = x - x0, y - y0
    result = (previous[y0, x0] * (1 - tx) * (1 - ty)
              + previous[y0, x1] * tx * (1 - ty)
              + previous[y1, x0] * (1 - tx) * ty
              + previous[y1, x1] * tx * ty)
    return np.where(valid, result, np.nan)


def _box_sum(values: np.ndarray, radius: int = 4) -> np.ndarray:
    padded = np.pad(values, radius)
    integral = np.pad(padded, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    n = 2 * radius + 1
    return integral[n:, n:] - integral[:-n, n:] - integral[n:, :-n] + integral[:-n, :-n]


def observed_tendency(previous: np.ndarray, current: np.ndarray, minutes: float,
                      dx: float, dy: float, quality: float) -> np.ndarray | None:
    """15–20-min motion-corrected local log-rate; neutral on weak evidence."""
    if (previous.shape != current.shape or previous.ndim != 2
            or not 15 <= minutes <= 20 or not np.isfinite(quality) or quality < 0.6
            or not np.isfinite(dx) or not np.isfinite(dy)):
        return None
    old = aligned_previous(previous, dx, dy)
    valid = np.isfinite(old) & np.isfinite(current)
    wet = valid & (old >= 0.1) & (current >= 0.1)
    if np.count_nonzero(wet) < 32:
        return None
    count = _box_sum(wet.astype(float))
    a = _box_sum(np.where(wet, old, 0.0))
    b = _box_sum(np.where(wet, current, 0.0))
    supported = (count >= 12) & wet
    rate = np.zeros_like(current, dtype=float)
    rate[supported] = np.log(b[supported] / a[supported]) / minutes
    # Ignore tiny fluctuations; limit growth and decay symmetrically.
    rate[np.abs(rate) < math.log(1.05) / minutes] = 0.0
    cap = math.log(1.35) / 20
    return np.clip(rate, -cap, cap)


def evolve_intensity(current: np.ndarray, rate: np.ndarray | None, lead_minutes: float) -> np.ndarray:
    """Damped extrapolation from observation, never recursively compounded."""
    if rate is None:
        return current.copy()
    # Evidence loses usefulness with lead time: effective growth saturates at 20 min.
    effective = 20 * (1 - math.exp(-max(0, lead_minutes) / 20))
    factor = np.clip(np.exp(rate * effective), 1 / 1.35, 1.35)
    return current * factor