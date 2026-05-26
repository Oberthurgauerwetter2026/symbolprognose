## Ziel

**Symbolprognose (phaseA)** nur noch **4× täglich** aktualisieren — um **02:00, 08:00, 14:00, 20:00 UTC** (je ~2 h nach den Modell-Läufen 00/06/12/18 UTC). Radar/Nowcast (phase1) und Bias-Lookback (phaseC) bleiben auf 5-Minuten-Takt.

Erwartete Open-Meteo-Last für phaseA: **~2'880 → ~40 Calls/Tag** (~98 % weniger).

## Umsetzung

### 1. `scripts/ingest_openmeteo.py` — zwei neue Modi
- `SKIP_PHASEA=1`: phase1 + phaseC frisch holen, phaseA-Block unverändert aus bestehendem R2-`forecast.json` übernehmen.
- `ONLY_PHASEA=1`: phaseA frisch holen, phase1 + phaseC unverändert aus bestehendem R2-`forecast.json` übernehmen.
- Ohne Flag: heutiges Verhalten (alle drei frisch — manueller Notfall-Run).

Implementierung: vor dem Schreiben von `forecast.json` den bestehenden Cache via `read_existing_payload()` laden (Funktion existiert bereits) und je nach Flag die fehlenden Phasen daraus übernehmen.

### 2. `.github/workflows/openmeteo-ingest.yml` (bestehend, 5-Min-Takt)
- Neue Env-Var `SKIP_PHASEA: "1"` ergänzen.
- Cron bleibt `*/5 * * * *`.

### 3. Neuer Workflow `.github/workflows/openmeteo-symbol.yml` (4× täglich)
- Cron: `0 2,8,14,20 * * *` + `workflow_dispatch`.
- Env-Var `ONLY_PHASEA: "1"`.
- Sonst identischer Aufbau wie `openmeteo-ingest.yml` (Checkout, Python, R2-Secrets, dasselbe Skript).

### 4. Frontend / Worker
Keine Änderung. `openmeteo/forecast.json` und das phaseA-Schema bleiben identisch — nur das Aktualisierungs-Intervall der phaseA-Einträge ändert sich.

## Edge Cases

- **Erster Lauf nach Deployment**: falls noch kein phaseA im Cache ist (sehr unwahrscheinlich, ist seit Wochen da), bleibt phaseA im `SKIP_PHASEA`-Run leer bis der erste `ONLY_PHASEA`-Run um 02:00 UTC läuft. Mitigation: nach Deployment einmal `openmeteo-symbol` manuell via `workflow_dispatch` triggern.
- **Race Condition**: theoretisch könnten 5-Min- und 4×-Workflow gleichzeitig schreiben (z. B. 02:00 UTC). Beide lesen denselben Cache und mergen jeweils ihre Phase rein → der spätere Write überschreibt — aber beide Versionen enthalten die jeweils anderen Phasen aus dem gemeinsamen Vorgänger-Cache. Im schlimmsten Fall ist eine Phase um einen Run veraltet (5 Min bzw. 6 h), kein Datenverlust. Akzeptabel.