## Änderung
**`src/components/maps/radar-map.tsx`** Zeile 572–577 — Label-Funktion vereinfachen:

| Vorher | Nachher |
|---|---|
| `Messung MeteoSchweiz` | `Messung` |
| `Prognose ICON-CH1` | `Modellprognose` |
| `Prognose ICON-CH2` | `Modellprognose` |

Beide ICON-Modelle werden zu „Modellprognose" zusammengefasst (technische Modellnamen tauchen weiterhin in der Quellenzeile im Footer auf, daher in der Karten-Badge redundant). Farben bleiben unverändert (CH1 = Brand-Blau, CH2 = Lila), sodass der Wechsel weiterhin visuell sichtbar ist.

Keine weiteren Änderungen.