# Warnhinweise in Symbol- und Lokalprognose

Aktive Warnungen sollen nicht nur auf `/karten/warnungen` sichtbar sein, sondern auch dort, wo Nutzer die Prognose lesen: in der Symbolprognose (Regionkarte) und in der Lokalprognose (Wetter-Widget) – jeweils als Gefahrensymbol in der Warnfarbe (Gelb/Orange/Rot).

## Gemeinsame Basis

- Neues Hilfsmodul `src/lib/warnings-lookup.ts` (client-safe):
  - `regionIdForPoint(lat, lon)` – Punkt-in-Polygon gegen `src/data/region.json`, Fallback: nächstgelegener Gemeindemittelpunkt.
  - `topWarningFor(warnings, regionId)` – höchste Stufe, bei Gleichstand die früher endende.
- Neue kleine Komponente `src/components/warnings/warning-badge.tsx`: Gefahren-Icon aus `HAZARDS` auf farbigem Chip (`LEVELS[level].color`), Grösse `sm`/`md`, Tooltip/Titel = Warntitel + Gültigkeit.
- Datenquelle: bestehende Server-Funktion `listWarnings` (öffentlich, kein Auth), im Client via TanStack Query mit ~5 Min. Refetch.

## Lokalprognose (`src/components/weather-widget.tsx`)

- Warnungen laden und über die aktuelle Koordinate die Region bestimmen.
- Im Kopfbereich (neben Ortsname/aktueller Temperatur) eine Warnzeile: farbiges Gefahren-Icon + Titel („Gewitterwarnung (Stufe 2)“) + Zeitraum; mehrere Warnungen als Chip-Reihe.
- Klick/Aufklappen zeigt Beschreibung und Auswirkung; Link auf `/karten/warnungen`.
- Im `compact`/`detailOnly`-Embed-Modus nur die Chip-Reihe (kein Aufklapp-Text), damit die Embed-Höhe stabil bleibt.
- Kein Rendering, wenn keine Warnung aktiv ist – Layout bleibt unverändert.

## Symbolprognose (`src/components/region-map.tsx`)

- Warnungen laden, jedem Spot aus `src/data/spots.ts` per Koordinate eine Gemeinde zuordnen.
- Am Spot-Marker zusätzlich ein kleines Gefahren-Icon in Warnfarbe (oben rechts am Symbol), damit das Wettersymbol selbst lesbar bleibt.
- Optional dezenter farbiger Rahmen um das Marker-Label in der Stufenfarbe.
- Popup/Tooltip des Spots ergänzt um Warntitel und Gültigkeit.

## Noscript-/Embed-Fallbacks

- `src/components/embeds/lokal-noscript.tsx` erhält eine optionale Warnzeile; die Daten kommen aus dem Loader (`buildLokalNoscriptData` bzw. ergänzend `readActiveWarnings`) in `embed.lokal.tsx` und `embed.region-lokal.tsx`, damit der JS-freie Fallback dieselbe Warnung zeigt.

## Technische Hinweise

- Kein Schema- oder Backend-Umbau; nur Lesen über die bestehende öffentliche `listWarnings`-Funktion und die vorhandenen RLS-Policies.
- Farben ausschliesslich aus `LEVELS` in `src/lib/warnings-config.ts`, keine neuen Hardcodes.
- Point-in-Polygon rein geometrisch (Ray-Casting) auf dem bereits gebündelten `region.json`, kein zusätzlicher Netzwerk-Call.
