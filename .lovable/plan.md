# Ortssuche-Banner in der Regionskarte

Oben in der Symbol-Regionskarte kommt ein halbtransparentes Suchband. Wer dort einen Ort eingibt und auswählt, landet direkt auf der Lokalprognose für diesen Ort. Die drei zuletzt gesuchten Orte werden beim Antippen des Feldes vorgeschlagen.

## Verhalten

- Band liegt halbtransparent über dem oberen Kartenrand (Lupe + Platzhalter „Ort, Berg, PLZ suchen“), Breite volle Kartenbreite, Ecken passend zur Karte.
- Ab 2 Zeichen erscheint eine Trefferliste (gleiche Ortssuche wie in der Lokalprognose, Schweiz-weit inkl. Bergen/PLZ soweit die Quelle liefert).
- Auswahl eines Treffers öffnet die Lokalprognose mit diesem Ort (`/karten/lokal?lat=…&lon=…&name=…`); im Embed-Modus als neuer Tab auf die öffentliche Seite.
- Leeres Feld + Fokus: Liste „Zuletzt gesucht“ mit den letzten 3 Orten (neuester zuerst, keine Duplikate). Ohne Verlauf wird keine Liste gezeigt.
- Verlauf wird lokal im Browser gespeichert und bei jeder Auswahl aktualisiert.
- Klick ausserhalb bzw. Escape schliesst die Liste. Das Suchband blockiert Karteninteraktion nur in seinem eigenen Bereich.
- Ein aktives Warn-/Vorinformationsband bleibt unverändert bestehen; das Suchband sitzt in der Karte, nicht darüber, sodass sich beide nicht in die Quere kommen.

## Technisch

- `src/components/region-map.tsx`: neue lokale Komponente `MapSearchBar` (absolut positioniert, `z-[500]`, `pointer-events-auto` in einem Overlay-Container), `searchLocations` aus `@/lib/weather.ts` per `useQuery` mit 300 ms Debounce.
- Navigation über `useNavigate` (`to: "/karten/lokal"`, `search: { lat, lon, name }`); bei `bare` stattdessen `<a target="_blank">` auf `${SITE_URL}/karten/lokal?…`.
- Verlauf: `localStorage`-Key `otw:lokal-recent`, Array aus `{ name, latitude, longitude, admin1 }`, max. 3 Einträge, Lesen erst nach Mount (kein SSR-Mismatch).
- Styling mit bestehenden Design-Tokens, halbtransparenter Grund (`bg-primary/70` + `backdrop-blur-sm`) analog zum Referenzbild; keine Hardcode-Farben.
- Keine Backend- oder Schema-Änderungen.
