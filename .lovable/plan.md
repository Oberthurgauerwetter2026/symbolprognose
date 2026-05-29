## Befund

- Ingest läuft erfolgreich, Grid wird geladen, Manifest wird geschrieben.
- Aber: `mean_accum=0.000mm` an jedem Horizont (ch1 h=0..3, ch2 h=0..6). Bei akkumuliertem TOT_PREC sollte spätestens nach mehreren Stunden ein Wert > 0 erscheinen, wenn auch nur lokal — sofern es überhaupt regnet.
- ch1 zeigt 11 Member (1 ctrl + 10 perturb) — laut MeteoSchweiz-Spec korrekt für ICON-CH1-EPS. ch2 zeigt erwartete 21.

Mögliche Ursachen für `0.000mm`:
1. **Echte trockene Wetterlage** in der Bbox 46.85–48.30 N / 8.15–10.55 E — durchaus plausibel Ende Mai.
2. **Falsche GRIB-Message dekodiert** — z. B. ein Diagnose-Feld statt `tp` selbst.
3. **Resample-Indizes danebengegriffen** — Bbox liegt zwar im Grid, aber Buckets könnten leer sein.
4. **Einheit/Skalierung** — TOT_PREC kommt manchmal in kg/m² (= mm), manchmal in m. Bei m statt mm wären die Zahlen so klein, dass `:.3f` sie als 0.000 zeigt.

## Plan: Diagnose vor weiterem Refactor

Nur zusätzliche Logs einbauen, nichts an der Veröffentlichungslogik ändern. Nach einem Lauf entscheiden wir, ob ein Fix nötig ist.

### Änderungen in `scripts/ingest_icon_eps.py`

1. **In `_open_grib_messages`** — pro Message einmalig loggen:
   - `shortName`, `name`, `units`, `paramId`, `typeOfLevel`, `level`
   - `values.min()`, `values.max()`, `values.mean()` (vor Resample, über das ganze native Grid)
   - Member-Zähler (perturbationNumber, falls vorhanden)
   - Nur die ersten 2 Messages pro Modell ausgeben (Modul-Set `_MSG_DIAG_SEEN`), sonst spamt das Log.

2. **In `decode_horizon`** — nach dem Resample loggen:
   - `cropped.min()`, `cropped.max()`, `cropped.mean()` für die erste Member
   - Anzahl Pixel > 0 (zeigt, ob das Feld in der Bbox wirklich überall null ist)
   - Pro Horizont nur einmal (für h=0 und h=max im Lauf).

3. **In `_build_resample_index`** — kurz loggen, wieviele der Output-Pixel auf einen leeren Bucket fallen (sollte 0 sein, sonst ist die Index-Konstruktion das Problem).

4. **Member-Konstante dokumentieren** — Kommentar bei `COLLECTIONS`:
   - `ch1`: 11 Member (1 ctrl + 10 perturb)
   - `ch2`: 21 Member (1 ctrl + 20 perturb)
   So fällt künftig schneller auf, wenn ein Modell weniger Member liefert als erwartet.

### Nicht in diesem Schritt
- Kein Eingriff am Manifest-Schema, an `_emit_step`, am Frontend oder am Workflow.
- Kein Refactor des Resamplers — erst wenn Logs zeigen, dass er das Problem ist.

## Validierung

Nächster Workflow-Lauf zeigt für ch1 und ch2 jeweils:
- Eine Diagnose-Zeile mit GRIB-Metadaten und nativem min/max/mean.
- Pro erstem/letztem Horizont eine Resample-Diagnosezeile.

Anhand der Werte entscheiden wir dann konkret:
- min/max nativ > 0 aber cropped == 0 → Resample-Bug, neuer Plan für KD-Tree-Fix.
- min/max nativ == 0 über alle Member → tatsächlich trockene Lage, kein Bug.
- units == "m" statt "kg m**-2" → Skalierung × 1000 nachziehen.
