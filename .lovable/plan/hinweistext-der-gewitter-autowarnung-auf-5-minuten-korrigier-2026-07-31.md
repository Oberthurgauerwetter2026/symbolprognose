# Hinweistext der Gewitter-Autowarnung auf 5 Minuten korrigieren

Im Warn-Tool steht unter „Gewitter-Autowarnung" weiterhin „Automatik läuft alle 15 Minuten …". Der Prüftakt wurde bereits auf 5 Minuten verkürzt, nur der Text ist veraltet.

## Änderung

- Der Hinweis lautet künftig: „Automatik läuft alle 5 Minuten und warnt ab 8 mm/h (Stufe 1), 15 mm/h (Stufe 2) und 30 mm/h (Stufe 3)."
- Keine Änderung an Schwellenwerten, Warntexten oder Push-Verhalten.

## Technische Details

- `src/routes/admin-warnungen.tsx` (Zeile 991): „15 Minuten" → „5 Minuten".
- `src/lib/ingest-admin.functions.ts` (Kommentar Zeile 120): „Cron alle 15 Minuten" → „alle 5 Minuten".
- Hinweis: Der schnellere Takt greift erst, wenn der Cron-Worker mit der bereits gemachten Änderung neu deployt ist.
