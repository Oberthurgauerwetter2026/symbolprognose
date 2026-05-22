## Ziel

MOSMIX-Stationsliste in `src/lib/mosmix.functions.ts` korrigieren und um Schweizer Stationen — insbesondere Güttingen und Bischofszell — erweitern.

## Probleme mit der aktuellen Liste

Beim Abgleich mit dem offiziellen DWD-Stationskatalog (`dwd.de/.../mosmix_stationskatalog.cfg`) zeigt sich:

| Aktuell hinterlegt | Tatsächliche Station mit dieser ID |
|---|---|
| 06610 „Sion" | Payerne |
| 06631 „Pully" | Bern-Liebefeld |
| 06632 „Payerne" | Grenchen |
| 06660 „Basel-Binningen" | Zürich (Stadt) |
| 06670 „Luzern" | Zürich-Kloten |
| 06680 „Zürich-Kloten" | Säntis |
| 06720 „St. Gallen" | Sion |
| 06770 „Lugano" | Lugano (korrekt) |
| 06780 „Samedan" | Weissfluhjoch |
| 06790 „Glarus" | Schiers |
| 06792 „Altdorf" | existiert nicht |
| 06810 „Säntis" | existiert nicht |

Zusätzlich sind die hinterlegten Koordinaten frei erfunden — der Katalog liefert sie im DDMM-Format (z. B. „47.30 9.14" = 47°30′N 9°14′E = 47.50°/9.23°), nicht Dezimalgrad.

## Neue Liste (alle verifiziert anhand DWD-Katalog, Koordinaten in Dezimalgrad)

Schweizer MOSMIX-Stationen, breit verteilt:

| ID    | Name              | Lat    | Lon   |
|-------|-------------------|--------|-------|
| 06601 | Basel             | 47.533 | 7.583 |
| 06604 | Neuchâtel         | 47.000 | 6.950 |
| 06610 | Payerne           | 46.817 | 6.933 |
| 06612 | La Chaux-de-Fonds | 47.083 | 6.800 |
| 06620 | Schaffhausen      | 47.683 | 8.617 |
| **06621** | **Güttingen**     | 47.600 | 9.283 |
| 06630 | Bern              | 46.917 | 7.500 |
| 06631 | Bern-Liebefeld    | 46.983 | 7.450 |
| 06632 | Grenchen          | 47.183 | 7.417 |
| 06650 | Luzern            | 47.017 | 8.300 |
| 06660 | Zürich (Stadt)    | 47.383 | 8.567 |
| 06670 | Zürich-Kloten     | 47.483 | 8.533 |
| **06678** | **Bischofszell**  | 47.500 | 9.233 |
| 06679 | Tänikon           | 47.467 | 8.900 |
| 06680 | Säntis            | 47.250 | 9.333 |
| 06681 | St. Gallen        | 47.433 | 9.400 |
| 06690 | Altenrhein        | 47.483 | 9.567 |
| 06700 | Genf              | 46.250 | 6.133 |
| 06711 | Pully             | 46.517 | 6.667 |
| 06720 | Sion              | 46.217 | 7.333 |
| 06734 | Interlaken        | 46.667 | 7.867 |
| 06760 | Locarno-Monti     | 46.167 | 8.783 |
| 06775 | Lugano            | 46.000 | 8.900 |
| 06784 | Davos             | 46.817 | 9.850 |
| 06786 | Chur              | 46.867 | 9.533 |

(Nachbar-Stationen in DE/AT/IT/FR können bleiben oder weg — siehe Rückfrage.)

## Umsetzung

1. `MOSMIX_STATIONS` in `src/lib/mosmix.functions.ts` komplett ersetzen.
2. Test: KMZ-Erreichbarkeit für `06621` (Güttingen) und `06678` (Bischofszell) per `curl` vorab prüfen (nicht jede Katalog-Station hat zwingend MOSMIX_L); bei 404 wird die Station entfernt.
3. Schwellwert `distanceKm > 60` bleibt — mit der dichteren CH-Abdeckung greift MOSMIX jetzt fast überall in CH.

## Rückfrage

Sollen die ausländischen Nachbar-Stationen (Friedrichshafen, Konstanz, Innsbruck, Mailand, Lyon) **drin bleiben** für grenznahe Punkte ausserhalb der CH, oder ist die App rein auf die Schweiz fokussiert und sie können raus?
