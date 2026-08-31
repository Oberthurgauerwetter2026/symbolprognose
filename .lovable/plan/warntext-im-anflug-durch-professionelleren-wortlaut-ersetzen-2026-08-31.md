# Warntext: „Im Anflug“ durch professionelleren Wortlaut ersetzen

## Befund (geprüft)

In `src/lib/auto-thunder.server.ts` (Zeile 235) lautet der Warntext für heranziehende Gewitterzellen:

> Im Anflug gemessene Spitzenintensität 42 mm/h.

Der Wortlaut wirkt umgangssprachlich und soll professioneller formuliert werden. Derzeit existiert nur diese eine Stelle im Code (gesucht in `src/` und `scripts/`).

## Änderung

In `src/lib/auto-thunder.server.ts` den Template-String für den Anflug-Fall ersetzen:

- Alt: `Im Anflug gemessene Spitzenintensität ${Math.round(v.peak)} mm/h.`
- Neu: `Heranziehende Zelle mit Spitzenintensität ${Math.round(v.peak)} mm/h.`

Der aktive Messfall bleibt unverändert: `Aktuell gemessene Spitzenintensität ${Math.round(v.peak)} mm/h.`

## Technische Details

- Datei: `src/lib/auto-thunder.server.ts`
- Betroffene Zeilen: 234–236 (Konstante `intensityText`)
- Keine Schema-, Ingest- oder UI-Änderungen nötig.
- Wirksam ab dem nächsten automatischen Gewitterwarnungslauf (5-Minuten-Takt).
