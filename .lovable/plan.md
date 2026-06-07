## Ziel

Eine interne Übersichtsseite `/intern/icons`, die alle vorhandenen Wetter-Symbole nebeneinander zeigt — inkl. der Winter-Varianten — damit du das komplette Set auf einen Blick siehst. Danach Screenshot als PNG nach `/mnt/documents/weather-icons.png`.

## Neue Datei: `src/routes/intern.icons.tsx`

- `createFileRoute("/intern/icons")` mit `ssr: false` und `head()` `noindex, nofollow` (analog `intern.niederschlag.tsx`, aber ohne Passwort-Schutz — reine Designreferenz).
- Layout: `max-w-7xl`, Sektionen als Grid (2/3/4/5 Spalten responsive).
- Pro Kachel: das Icon zweimal nebeneinander (heller + dunkler Hintergrund), darunter Komponentenname (monospace) + Auslöse-Hinweis (WMO-Codes oder Bedingung).
- Icon-Grösse einheitlich 72 px.

## Sektionen

1. **Klar / wenig Wolken** — `IconClear`, `IconClearNight`, `IconMostlyClear` (Tag + Nacht), `IconPartlyCloudy` (Tag + Nacht).
2. **Bewölkt / Nebel** — `IconCloudy`, `IconFog`.
3. **Niederschlag** — `IconDrizzle`, `IconRain`, `IconSunShower`, `IconThunderstorm`, `IconSunThunder` (Intensität 2, 3, 4).
4. **Winter / Schnee** — `IconSnow`, `IconSnowThunder`, `IconSunSnowThunder` (Intensität 2, 3, 4).
5. **Dispatcher-Beispiele** — fünf Aufrufe des `WeatherIcon`-Dispatchers, die die wichtigen Korrektiv-Regeln demonstrieren (Stockwerke → `Cloudy`/`MostlyClear`, Sonnen-Korrektiv bei `code=3` + viel Sonne, Sonnenschauer-Override für `code=61` mit Sonne, daily-wet mit Sonne → `SunShower`).

## Verifikation

- Nach dem Erstellen Route im Preview öffnen (`/intern/icons`), per `browser--screenshot` mit `full_page: true` aufnehmen und nach `/mnt/documents/weather-icons.png` speichern, sodass das Bild direkt verfügbar ist.

## Nicht angefasst

- Bestehende Icon-Komponenten, Dispatcher-Logik, andere Routen, Sidebar/Menü (Seite bleibt unverlinkt und nur via direkter URL erreichbar).
