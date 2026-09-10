# Gewitter-Symbol prüfen und Fehlanzeige verhindern

## Befund

Für heute (10.9.) zeigt die Lokalprognose ein Gewitter — im aktuellen Block steht „Gewitter · 03:32“. Die Zahlen derselben Seite widersprechen dem klar:

- Niederschlag in allen kommenden Stunden 0.0 mm, Tagessumme heute und morgen 0.0 mm.
- Das Modell ICON-CH1/best_match liefert für heute nur Codes „bewölkt/heiter/Nebel“, Niederschlagswahrscheinlichkeit maximal 8 %.

Ein Gewitter ist also nach den vorliegenden Daten nicht plausibel — die Anzeige ist falsch, nicht die Wetterlage.

## Wo es herkommt

Primärquelle der Lokalprognose ist die MeteoSchweiz-Punktprognose. Deren Symbolnummer wird im Import über eine Zuordnungstabelle in einen WMO-Code übersetzt; mehrere Nummern landen dort auf „Gewitter“. Ergibt eine einzelne Stunde „Gewitter“, wird zusätzlich der ganze Tag auf Gewitter gesetzt. Ob im aktuellen Fall die Symbolnummer falsch übersetzt wird oder eine einzelne Gewitterstunde den Tag prägt, ist noch nicht bewiesen — die Rohdatei ist von hier nicht direkt lesbar.

## Vorgehen

1. **Ursache belegen:** Die MeteoSchweiz-Punktprognose für Amriswil direkt abfragen und die Symbolnummern der letzten und nächsten Stunden mit Niederschlag/Gewitterwahrscheinlichkeit gegenüberstellen. Damit steht fest, ob die Übersetzungstabelle falsche Einträge hat (z. B. Schnee- oder Nebelsymbole, die auf Gewitter gemappt werden) oder ob eine echte, aber einzelne Gewitterstunde vorliegt.
2. **Übersetzungstabelle korrigieren:** Falsche Einträge gegen die offizielle MeteoSchweiz-Symbolliste richtigstellen, inklusive Nachtsymbole.
3. **Plausibilitätsprüfung ergänzen:** Ein Gewittersymbol wird nur noch übernommen, wenn dieselbe Stunde auch Niederschlag zeigt (Schwelle wie bei der bestehenden „Geisterblitz“-Regel, ab 0.5 mm). Ohne Niederschlag fällt das Symbol auf Schauer bzw. Bewölkung zurück.
4. **Tagessymbol strenger:** Der Tag wird nur noch als Gewittertag dargestellt, wenn mindestens eine Gewitterstunde mit Niederschlag vorliegt und die Tagessumme nicht bei 0 mm liegt. Ansonsten gilt das normale Trocken-/Schauerschema.
5. **Nachprüfen:** Lokalprognose Amriswil und Wetterkarte Region kontrollieren — heute darf kein Gewitter mehr erscheinen; ein echter Gewittertag muss weiterhin als Gewitter erscheinen.

## Technische Details

- `scripts/ingest_mch_local_forecast.py`: `MCH_ICON_TO_WMO` gegen die offizielle Pictogramm-Liste verifizieren und korrigieren; `map_weathercode` unverändert lassen.
- `src/lib/forecast-aggregated.functions.ts` (`forecastFromMchCache`): Gewittercodes (95/96/99) aus der MCH-Quelle nur setzen, wenn `precipitation` der Stunde ≥ 0.5 mm ist, sonst auf 80/81 bzw. Bewölkungscode zurückfallen.
- `src/lib/weather.ts` (`aggregateDailyFromHourly`): `thunderHours` nur aus Stunden mit Niederschlag ≥ 0.1 mm zählen; damit greift `weathercode = 95` nicht mehr bei trockenen Tagen. Der bestehende Overlay-Guard (`p < 0.5`) bleibt.
- Wirksam für Lokalprognose, Wetterkarte Region, Embeds und serverseitige Symbole, da alle denselben Aggregationspfad nutzen. Punkt 1 gilt für den nächsten Import-Lauf.
