## Befund (mit den neuen Diagnosen)

Die Daten sind **da und nicht-null** — der Log ist nur missverständlich.

Konkret aus deinem Lauf:
- `[msg-diag]` zeigt für h=0 native `max=0.000` — korrekt: akkumuliertes TOT_PREC ist bei Lead 0 per Definition 0.
- Ab h=1 wächst `stack max` plausibel an (ch2: 0.6 → 1.7 → 1.8 → 4.6 mm akkumuliert), `n>0` steigt auf bis zu 18 515 Pixel pro Member-Stack. Es regnet also.
- `member0 max=0.000` ist Zufall: in `as_completed`-Reihenfolge landet der Ctrl-Run (deterministisch trocken in der Bbox) zuerst in `members[0]`. Kein Bug.
- `mean_accum=0.000mm` ist ein **Anzeige-Bug**: wir mitteln über *alle* Member × *alle* Pixel des Stacks (akkumuliert), und weil >99 % der Pixel trocken sind, rundet `:.3f` auf 0. Beispielrechnung h=4 ch2: 18 472 nasse Zellen × ~1 mm / (786 432 × 21) ≈ 0.001 mm — gerundet 0.000.
- Die tatsächliche Veröffentlichungslogik (`_emit_step`) rechnet pixelweise `mean = nanmean(delta, axis=0)` und schreibt `maxMmh`/`meanWetFrac` ins Manifest — diese Werte sehen wir aber nirgends im Log.

Es gibt also nichts an der Datenpipeline zu reparieren. Was fehlt, ist eine ehrliche Diagnose, die zeigt, was wirklich im Manifest landet.

## Plan: Nur Logs nachschärfen

### Änderung 1 — `decode_horizon` (scripts/ingest_icon_eps.py, ~Z. 747-762)

Die irreführende `mean_accum`-Zeile umformulieren bzw. ergänzen:
- Statt "mean_accum" → "stack_accum": macht klar, dass es der akkumulierte Stack-Mittelwert über alle Pixel ist.
- Zusätzlich loggen: Anzahl Member mit mindestens einem nassen Pixel (`members_with_rain`) — so sieht man auf einen Blick die Spread.
- `member0` aus dem Log entfernen, weil die Reihenfolge nicht stabil ist und der Wert keine Aussagekraft hat.

### Änderung 2 — `_emit_step` (~Z. 825-860)

Eine neue, kurze Zeile pro emittiertem Schritt — *nach* der Berechnung von `mean` / `prob`, *vor* dem Upload:

```
[emit h=  4 interval=1h max_mmh=0.219 wet_frac=0.0234 n_wet_px=18403 mean_max_member=4.60]
```

Felder:
- `max_mmh` = `float(np.nanmax(mean))` (das, was als `maxMmh` ins Manifest geht).
- `wet_frac` = wie bisher.
- `n_wet_px` = `int((mean > 0.1).sum())`.
- `mean_max_member` = `float(np.nanmax(mmh))` (max über alle Member, vor dem Member-Mittel).

Damit ist auf einen Blick sichtbar: kommt im PNG tatsächlich Regen an oder nicht.

### Nicht angefasst

- Kein Eingriff in Decode, Resample, Akkumulationsdiff, PNG-Render, Manifest, Frontend.
- Keine Änderung an Workflow oder R2-Layout.

## Validierung

Nächster Lauf zeigt für ch2 idealerweise so etwas wie:
```
h=  4 members=21 stack_accum=… [stack max=4.602 n>0=18472 members_with_rain=15]
[emit h=  4 interval=1h max_mmh=… wet_frac=… n_wet_px=… mean_max_member=4.60]
```
Daraus können wir entscheiden, ob `_emit_step` das Erwartete schreibt oder ob doch noch etwas hakt (z. B. `nanmean` über NaN-haltige Member, falsche Achse o. ä.). Aktuelle Evidenz spricht dafür, dass alles funktioniert.
