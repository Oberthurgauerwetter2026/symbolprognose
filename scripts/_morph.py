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


def _component_neighbor_classes(classes: np.ndarray, component: np.ndarray) -> np.ndarray:
    """Klassenwerte der 4-Nachbarn einer Komponente."""
    h, w = classes.shape
    vals: list[np.ndarray] = []
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        y0 = max(0, -dy)
        y1 = h - max(0, dy)
        x0 = max(0, -dx)
        x1 = w - max(0, dx)
        center = component[y0:y1, x0:x1]
        if not center.any():
            continue
        neigh_component = component[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        neigh_values = classes[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        boundary = center & ~neigh_component
        if boundary.any():
            vals.append(neigh_values[boundary])
    if not vals:
        return np.array([], dtype=classes.dtype)
    return np.concatenate(vals)


def _touches_border(labels: np.ndarray, lab: int) -> bool:
    return (
        bool(np.any(labels[0, :] == lab))
        or bool(np.any(labels[-1, :] == lab))
        or bool(np.any(labels[:, 0] == lab))
        or bool(np.any(labels[:, -1] == lab))
    )


def _dominant(values: np.ndarray, max_class: int) -> int | None:
    if values.size == 0:
        return None
    counts = np.bincount(values.astype(np.int16), minlength=max_class + 1)
    return int(np.argmax(counts))


def _replace_small_components(
    classes: np.ndarray,
    class_id: int,
    max_area_px: int,
    *,
    fill_holes: bool,
) -> None:
    if max_area_px < 1:
        return
    labels, sizes = _label_4conn(classes == class_id)
    if labels.max() <= 0:
        return

    max_class = int(classes.max())
    small = [lab for lab in range(1, len(sizes)) if sizes[lab] <= max_area_px]
    for lab in small:
        if fill_holes and _touches_border(labels, lab):
            continue
        component = labels == lab
        neigh = _component_neighbor_classes(classes, component)
        if fill_holes:
            # Transparente Mini-Löcher nur mit umliegendem Niederschlag füllen.
            neigh = neigh[neigh > 0]
            target = _dominant(neigh, max_class)
            if target is not None:
                classes[component] = target
            continue

        # Kleine farbige Inseln/Punkte innerhalb einer Fläche werden in die
        # dominante Nachbar-Niederschlagsklasse aufgenommen. Isolierte
        # Niederschlags-Inseln im Hintergrund verschwinden vollständig.
        positive_neigh = neigh[neigh > 0]
        target = _dominant(positive_neigh, max_class)
        classes[component] = target if target is not None else 0


def clean_precip_field(
    values: np.ndarray,
    scale: list,
    min_area_px: int,
    hole_area_px: int,
) -> np.ndarray:
    """Bereinigt `values` auf diskreten Farbklassen vor dem PNG-Mapping.

    Die Bereinigung arbeitet rein topologisch auf den später sichtbaren
    Niederschlagsklassen: kleine farbige Inseln werden durch die dominante
    4-Nachbar-Klasse ersetzt, isolierte Mini-Niederschlagsgebiete entfernt und
    kleine transparente Löcher innerhalb von Flächen gefüllt. Keine
    Interpolation, kein Blur, keine Konturglättung, keine Auflösungsänderung.
    """
    if values.size == 0:
        return values

    thresholds = [float(t) for t, _ in scale]
    if not thresholds:
        return values.astype(np.float32, copy=True)

    finite = np.isfinite(values)
    classes = np.zeros(values.shape, dtype=np.int16)
    for idx, t in enumerate(thresholds, start=1):
        classes[finite & (values >= t)] = idx

    if not np.any(classes > 0):
        return np.zeros(values.shape, dtype=np.float32)

    hole_area = max(0, int(hole_area_px))
    speckle_area = max(0, int(min_area_px))

    _replace_small_components(classes, 0, hole_area, fill_holes=True)
    for class_id in range(1, len(thresholds) + 1):
        _replace_small_components(classes, class_id, speckle_area, fill_holes=False)

    out = np.zeros(values.shape, dtype=np.float32)
    for idx, t in enumerate(thresholds, start=1):
        out[classes == idx] = t
    return out
