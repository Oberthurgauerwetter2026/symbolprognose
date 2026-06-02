## Ziel
Die neuen Gewitter-Icons (`IconSunThunder`, `IconSunSnowThunder`, `IconThunderstorm`, `IconSnowThunder`) sollen bereits bei schwächeren Signalen erscheinen, damit konvektive Lagen nicht durch konservative Schwellen verloren gehen.

## Änderungen

### 1. `src/lib/weather.ts` – Gewitter-Override (Zeile 736–756)
Niederschlagsschwelle für die Übernahme von WMO-Code 95/96/99 aus `best_match` / MOSMIX in den geglätteten Ensemble-Mittel-Strang senken:
- **alt:** `if (p < 2) continue;` (mind. 2 mm/h)
- **neu:** `if (p < 0.5) continue;` (mind. 0.5 mm/h)

Damit werden auch schwache Gewitterschauer ins ICON-CH2-Ensemble übertragen, wo das Ensemble-Mittel den Gewittercode wegmittelt.

### 2. `src/components/weather-icons/index.tsx` – Daily-Gewitterlogik (Zeile 447–468)
Schwellen lockern, sodass Sonne+Gewitter-Icon schon bei minimalem konvektivem Signal greift:

| Bedingung | alt | neu |
|---|---|---|
| Trigger für Daily-Gewitterzweig | `thunderHours ≥ 1` oder WMO-Thunder | unverändert |
| `heavyThunder` Vollgewitter | `th ≥ 3` ODER (`th ≥ 2` & `precip ≥ 8`) ODER (WMO & `precipHours ≥ 5` & nicht sonnig) | `th ≥ 4` ODER (`th ≥ 3` & `precip ≥ 8`) ODER (WMO & `precipHours ≥ 6` & nicht sonnig) |
| `sunny` (→ Sonne+Gewitter) | `sunshineRatio ≥ 0.15` & `precipHours < 8` | `sunshineRatio ≥ 0.10` & `precipHours < 10` |

**Effekt:** Typische Sommer-Konvektionstage mit 1–3 Gewitterstunden und mittlerem Sonnenanteil zeigen jetzt verlässlich das Sonne-Wolke-Tropfen-Blitz-Icon statt eines reinen Regen-/Bewölkt-Icons. Vollgewitter bleibt den wirklich gewittergeprägten Tagen vorbehalten.

## Verifikation
- `/karten/lokal` öffnen, mehrere Orte/Tage durchklicken; bei aktuellen Daten erscheinen — sobald irgendein Modell Code 95/96/99 mit ≥ 0.5 mm/h liefert — die neuen Symbole.
- Falls aktuell keine Gewitter prognostiziert sind (typisch Anfang Juni nach kühler Nordlage), bleibt die Anzeige korrekt ohne Gewitter — die Logik ist dann nicht sichtbar, aber die nächsten konvektiven Tage triggern verlässlich.
- Stündliche Icons bleiben unverändert (greifen schon ab kleinen Mengen).
