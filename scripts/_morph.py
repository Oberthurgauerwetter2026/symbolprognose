"""Morphologische Bereinigung von Niederschlagsfeldern.

Entfernt vor dem Farb-Mapping isolierte Einzelpixel / winzige Inseln aus
jedem Intensitätsband und füllt kleine Löcher innerhalb zusammenhängender
Flächen. Rein wertbasiert — keine Kantenglättung, keine Interpolation, keine
Auflösungs- oder Konturänderung. Nur NumPy, kein SciPy-Import nötig.
"""

from __future__ import annotations

import numpy as np


def _label_4conn(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """4-Konnektivitäts-Connected-Components via Two-Pass + Union-Find.

    Rückgabe: (labels[H,W] int32, sizes[nlabels+1] int32) — Index 0 = Background.
    """
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    parent: list[int] = [0]

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> int:
        ra, rb = find(a), find(b)
        if ra == rb:
            return ra
        if ra < rb:
            parent[rb] = ra
            return ra
        parent[ra] = rb
        return rb

    next_label = 1
    for y in range(h):
        row = mask[y]
        lrow = labels[y]
        prev_row = labels[y - 1] if y > 0 else None
        for x in range(w):
            if not row[x]:
                continue
            left = lrow[x - 1] if x > 0 else 0
            up = prev_row[x] if prev_row is not None else 0
            if left and up:
                lrow[x] = union(left, up)
            elif left:
                lrow[x] = left
            elif up:
                lrow[x] = up
            else:
                lrow[x] = next_label
                parent.append(next_label)
                next_label += 1

    # Zweiter Pass: Root-Label auflösen und kompaktieren.
    remap = np.zeros(len(parent), dtype=np.int32)
    compact_next = 1
    for i in range(1, len(parent)):
        r = find(i)
        if remap[r] == 0:
            remap[r] = compact_next
            compact_next += 1
        remap[i] = remap[r]

    if next_label > 1:
        labels = remap[labels]

    sizes = np.bincount(labels.ravel(), minlength=compact_next)
    return labels, sizes


def clean_precip_field(
    values: np.ndarray,
    scale: list,
    min_area_px: int,
    hole_area_px: int,
) -> np.ndarray:
    """Bereinigt `values` bandweise anhand der Schwellen in `scale`.

    - Entfernt Komponenten `>= t` mit Fläche `< min_area_px` (Wert wird auf
      den nächst-tieferen Schwellwert bzw. 0/NaN gesenkt, damit dieser Pixel
      in einer tieferen Klasse landet).
    - Füllt Löcher (`< t`) mit Fläche `< hole_area_px`, die vollständig
      innerhalb einer `>= t`-Region liegen (Wert wird auf `t` angehoben).

    `scale` ist die Liste `[(thresh, rgba), ...]` aufsteigend sortiert.
    Werte in `values` dürfen NaN sein (werden als "nicht Niederschlag"
    behandelt und nicht verändert).
    """
    if values.size == 0:
        return values
    out = values.astype(np.float32, copy=True)
    thresholds = [float(t) for t, _ in scale]
    if not thresholds:
        return out

    h, w = out.shape
    finite = np.isfinite(out)

    for i, t in enumerate(thresholds):
        # Fallback-Wert für Pixel, die aus dem Band herausfallen:
        # der nächst-tiefere Schwellwert minus ein Epsilon (bzw. 0 unterhalb
        # der ersten Klasse). So bleibt der Pixel in einer tieferen Klasse
        # und wird nicht komplett transparent, ausser er ist schon unter t0.
        lower = thresholds[i - 1] if i > 0 else 0.0
        demote_value = max(0.0, lower - 1e-6) if i > 0 else 0.0

        mask = finite & (out >= t)
        if mask.any() and min_area_px > 1:
            labels, sizes = _label_4conn(mask)
            small = np.where(sizes < min_area_px)[0]
            # Label 0 = Background ausschliessen.
            small = small[small > 0]
            if small.size > 0:
                small_mask = np.isin(labels, small)
                out[small_mask] = demote_value

        # Löcher füllen: alles < t innerhalb der Fläche, das eine kleine
        # zusammenhängende Komponente bildet und den Bildrand NICHT berührt.
        if hole_area_px > 1:
            mask_after = finite & (out >= t)
            if mask_after.any():
                hole_mask = ~mask_after
                labels_h, sizes_h = _label_4conn(hole_mask)
                if labels_h.max() > 0:
                    # Randberührende Komponenten sind "aussen", nicht Löcher.
                    border = np.concatenate([
                        labels_h[0, :], labels_h[-1, :],
                        labels_h[:, 0], labels_h[:, -1],
                    ])
                    outside = set(int(x) for x in border.tolist() if x != 0)
                    small_holes = [
                        lab for lab in range(1, len(sizes_h))
                        if lab not in outside and sizes_h[lab] < hole_area_px
                    ]
                    if small_holes:
                        fill = np.isin(labels_h, np.array(small_holes, dtype=np.int32))
                        out[fill] = t

    return out
