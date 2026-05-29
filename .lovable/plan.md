## Diagnose

Im neuen Lauf zeigt der Log endgültig den Bug:

ch2 `stack max` bleibt bei h=4,5,6,7 konstant **4.602 mm** (akkumuliert) — d. h. zwischen h=4 und h=7 fällt im Modell **kein zusätzlicher Niederschlag** in der Bbox. Das Delta `cur_accum − prev_accum` müsste also ~0 sein und `max_mmh` ebenfalls 0. Tatsächlich emittiert `_emit_step` aber konstant **`max_mmh=0.219`**, was exakt `4.602 / 21` (Member-Anzahl) entspricht.

Das ist kein Zufall: das Delta ist nicht null, sondern ein **Permutations-Artefakt**. Begründung:

- In `decode_horizon` (Z. 724-744) werden Member-Buffer per `as_completed(...)` eingesammelt — Reihenfolge ist nicht deterministisch.
- `np.stack(members, axis=0)` legt damit pro Horizont **eine andere Permutation** der physischen Member auf Achse 0 ab.
- In `_emit_step` (Z. 832) rechnet `delta = clip(cur_accum − prev_accum, 0, None)` member-weise. Wenn die Member-Achse zwischen `cur` und `prev` permutiert ist, subtrahiert man **Member A bei h=5 minus Member B bei h=4** statt A−A.
- Bei identischen Stacks (h=5,6,7) sind die Werte als Menge gleich, aber pro Slot unterschiedlich → punktuelle positive Differenzen, danach `np.nanmean(mmh, axis=0)` ergibt einen Mittelwert in der Größenordnung von `max(accum) / members` = 4.602/21 ≈ 0.219.
- Bei h=1 ch2 fällt der Bug nicht auf, weil `prev = zeros` ist; jede Permutation ergibt dasselbe Ergebnis.

Folge: Mean-PNG und Probability-PNG sind systematisch falsch (zu wenig Regen, an falschen Stellen), nicht nur ein Anzeige-Problem.

## Fix-Plan

### Änderung 1 — `_open_grib_messages` (~Z. 408)

Statt `list[tuple[values, lats, lons]]` zusätzlich `perturbationNumber` (und ob es ctrl ist) mitgeben:

```
list[tuple[int, np.ndarray, np.ndarray, np.ndarray]]
        ^member_key
```

`member_key` = `int(perturbationNumber)` falls vorhanden, sonst `-1` (für ctrl, dessen `perturbationNumber` oft 0 ist — Unterscheidung ctrl/pert erfolgt zusätzlich per Dateinamen-Suffix `-ctrl` / `-perturb`, den wir an `_open_grib_messages` als Hinweis durchreichen können, oder einfacher: alle Member identifizieren über `(is_ctrl, perturbationNumber)` und im Aufrufer in ein eindeutiges Int mappen).

Einfachster Schnitt: `member_key = -1 if is_ctrl else int(perturbationNumber)`, wobei `is_ctrl` aus dem STAC-Item (`it.asset`/URL enthält `-ctrl`) bestimmt und an `_open_grib_messages` durchgereicht wird.

### Änderung 2 — `decode_horizon` (~Z. 717-765)

- Buffer in `as_completed` weiterhin sammeln, aber zusammen mit dem `is_ctrl`-Flag des jeweiligen STAC-Items (kommt aus `futs[fut]`).
- Pro decodierter Message ein Paar `(member_key, cropped)` ablegen.
- Vor `np.stack`: `pairs.sort(key=lambda p: p[0])` → deterministische Member-Achse.
- Optional: prüfen, dass `member_keys` zwischen Horizonten **identisch** sind; bei Abweichung warnen (`! member set drift at h=…`) und `_emit_step` überspringen, statt falsche Diffs zu emittieren.

### Änderung 3 — Diagnose-Zeile in `decode_horizon`

Ergänzen: `member_keys=[-1,1,2,…]` (gekürzt auf erste/letzte 3) — so sieht man im Log, dass die Reihenfolge stabil ist.

### Nicht angefasst

- `_emit_step` selbst bleibt unverändert (Logik ist korrekt, sobald Member-Achse stabil ist).
- Resample, PNG-Render, Manifest-Format, Frontend, Workflow — alles unverändert.

## Validierung

Nächster Lauf soll für ch2 zeigen:

```
h=  4 members=21 stack_accum_mean=… member_keys=[-1,1,2,…19,20]
[emit h=  4 ... max_mmh≈0.22 ...]
h=  5 members=21 ... member_keys=[-1,1,2,…19,20]   ← gleiche Reihenfolge
[emit h=  5 ... max_mmh≈0.000 n_wet_px=0 ...]      ← weil stack identisch zu h=4
h=  6 [emit ... max_mmh≈0.000 ...]
h=  7 [emit ... max_mmh≈0.000 ...]
```

Sobald `max_mmh` bei identischen Stacks wieder ~0 ist, ist die Pipeline korrekt; spätere Horizonte mit echtem Zuwachs liefern dann die korrekten mm/h.
