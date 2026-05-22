## Ziel

Die App wird vom Single-Widget zu einer **Karten-Plattform** mit Dashboard-Optik. Jede Karte ist eigenständig (eigene Route, eigenes Embed) und kann zusätzlich in einer Tab-Leiste der Hauptansicht zusammen mit den anderen Karten genutzt werden.

## Neue Routenstruktur

```text
/                      Dashboard (Adminboard-Optik mit Sidebar + Header)
                       Kachel-Übersicht aller Karten
/karten/region         Wetterkarte Region (heute /karte) — mit Tab-Leiste oben
/karten/lokal          Lokalprognose (heute /) — als Tab erreichbar
/karten/wind           Wind-Animation (Platzhalter "in Vorbereitung")
/karten/radar          Radar Vergangenheit + Vorhersage (Platzhalter)
/karten/pollen         Pollenprognose (Platzhalter)
/karten/gefahren       Gefahrenkarte (später, vorerst nicht angelegt)

/embed/region          Chrome-lose Embed-Variante (iframe-fähig)
/embed/lokal           Embed Lokalprognose (Migration der bisherigen /)
/embed/wind            Embed Wind
/embed/radar           Embed Radar
/embed/pollen          Embed Pollen
/embed/all             Embed der Hauptansicht inkl. Tab-Leiste über alle Karten

/admin                 Bleibt (Passwort-Bereich, Spot-Tools)
/embed-info            Wird auf neue Embed-Routen umgestellt; Snippet je Karte
```

Die bisherige `/` (WeatherWidget) wird zu `/karten/lokal` + `/embed/lokal`. Die alte URL `/` bleibt erhalten, zeigt aber das neue Dashboard. Bestehende WordPress-iframes mit `/?embed=…` werden auf `/embed/lokal` per Weiterleitung im Index gemappt, damit nichts bricht.

## Komponenten-Architektur

- `src/components/dashboard-layout.tsx` — Wrapper mit `SidebarProvider`, Sidebar (Lucide-Icons, aktive Route via `useRouterState`) und Header (`SidebarTrigger`, Logo, Datenstand). Nur für Nicht-Embed-Routen.
- `src/components/map-tabs.tsx` — horizontale Tab-Leiste oben auf jeder `/karten/*`-Seite mit Tabs „Region · Lokal · Wind · Radar · Pollen". Aktiver Tab anhand der Route. Tabs sind `<Link>`-Elemente, kein State.
- `src/components/region-map.tsx` — bleibt; Verschiebung in Route `/karten/region`.
- `src/components/weather-widget.tsx` — bleibt; wird in `/karten/lokal` und `/embed/lokal` gerendert.
- `src/components/maps/wind-map.tsx`, `radar-map.tsx`, `pollen-map.tsx` — neue Platzhalter (gleiche äußere Hülle wie RegionMap: Karte links, Slider/Steuerung unten), mit „Bald verfügbar"-Overlay.
- `src/components/embed-shell.tsx` — schlanke Hülle ohne Sidebar/Header, nur das Karten-Innere + automatisches `postMessage` für die iframe-Höhe (analog dem aktuellen WeatherWidget-Verhalten).

## Dashboard (/)

- Sidebar links: „Übersicht", Gruppe „Karten" mit Region, Lokal, Wind, Radar, Pollen; Gruppe „Werkzeuge" mit Embed-Snippets, Admin.
- Header oben: Sidebar-Toggle, Projektname, globaler Datenstand.
- Hauptbereich: Kachel-Grid (Region groß, andere kleiner) mit Vorschau-Thumbnail, Status („Live" / „Bald verfügbar") und „Öffnen"-Link auf die jeweilige `/karten/*`-Route.

## Tab-Umschalter auf `/karten/*`

Über jeder Karte erscheint die `MapTabs`-Komponente. Sie ersetzt visuell den heutigen „← Zur Prognose"-Button auf `/karte` und macht die Lokalprognose zu einem Tab dort, wo aktuell „Prognose" steht. Bei Platzhalter-Karten erscheint der Tab als aktiv, der Inhalt zeigt „Bald verfügbar".

## Embedding

Zwei nutzbare Embed-Varianten pro WordPress-Seite:

1. **Einzelne Karte**: `/embed/{region|lokal|wind|radar|pollen}` — nur diese Karte, kein Tab, kein Header. Höhe per `postMessage`.
2. **Komplett-Widget**: `/embed/all` — Hauptkarte (Region) + Tab-Leiste; Besucher wechseln im iframe selbst.

`/embed-info` wird neu aufgebaut: Eine Tab-Leiste pro Karte mit dem Snippet, plus separater Block „Alle Karten in einem Widget" (`/embed/all`). Optionale Query-Parameter dokumentieren: `?spot=horn`, `?day=1`, `?theme=light|dark` (Light/Dark wird vorbereitet, Default „light").

## Migration der bestehenden `/?embed=minimal`-Snippets

Damit produktive iframes nicht brechen, leitet `/` mit `?embed=…` per Client-Redirect auf `/embed/lokal?…` weiter. Das Snippet auf `/embed-info` wird neu generiert.

## Umsetzungsreihenfolge

1. Routen anlegen: `/karten/{region,lokal,wind,radar,pollen}` und `/embed/{…}` + `/embed/all`. Pro Route `head()` mit eigenem Titel/Description.
2. `DashboardLayout` + `AppSidebar` bauen und auf `/` + `/karten/*` + `/admin` anwenden (nicht auf `/embed/*`).
3. `MapTabs` bauen und in alle `/karten/*`-Routen einsetzen.
4. Bestehenden Inhalt von `/karte` und `/` in die neuen Routen verschieben; alte Routen als Redirects belassen.
5. Platzhalter-Karten (`WindMap`, `RadarMap`, `PollenMap`) mit „Bald verfügbar"-Overlay, aber gleicher Karten-Hülle wie RegionMap.
6. `EmbedShell` + Embed-Routen.
7. `/embed-info` neu mit Snippet pro Karte + Komplett-Widget.
8. `/` (alt) → Redirect-Logik für `?embed=…` einbauen.

## Technische Hinweise

- Sidebar-Komponente: shadcn `sidebar` (bereits im Projekt), Icons via `lucide-react` (Map, Wind, CloudRain, Flower2, Layout, Settings).
- Aktive Route per `useRouterState({ select: (s) => s.location.pathname })`.
- Alle neuen Routen typgeprüft mit `createFileRoute`; keine Bearbeitung von `routeTree.gen.ts`.
- Embed-Routen: `ssr: false` setzen (Karte/Leaflet braucht Browser), und im `__root.tsx` keinen Sidebar-Wrapper rendern. Konkret: Sidebar wird nicht ins `__root.tsx` gehoben, sondern pro Layout-Route (`/karten`, `/`, `/admin`) verwendet, sodass `/embed/*` frei davon bleibt.
- Design-Tokens (`src/styles.css`) unverändert; neue Komponenten verwenden bestehende `bg-card`, `text-foreground`, `border-border`, BRAND-Farbe.

## Was bewusst NICHT in diesem Schritt enthalten ist

- Echte Wind-/Radar-/Pollen-Daten und Animationen (nur Hülle + „Bald verfügbar").
- Gefahrenkarte.
- Echte Login-Auth fürs Adminboard (bleibt visueller Stil + bestehender Passwort-Schutz auf `/admin`).
- Theme-Switch (nur als Embed-Parameter vorgesehen, ohne aktive Dark-Variante).