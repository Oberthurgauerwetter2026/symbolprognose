## Ziel

Eine interne Karte, die akkumulierte Niederschlagsmengen für die nächsten **12h, 24h und 48h** über der Region Oberthurgau zeigt — als Heatmap (gleicher Stil wie die bestehende Radarkarte), mit **PNG-Download pro Zeitfenster**. Zugang nur für eingeloggte Nutzer.

## Datenquelle

ICON-CH1/CH2 GRIB-Daten aus dem bestehenden R2-Cache (`scripts/ingest_arome.py` / `radar-ingest`). Diese liefern stündliche Niederschlagsprognosen bis +120 h und sind bereits ingestiert.

- Akkumulation: Summe der stündlichen `tp` (total precipitation) Werte über das jeweilige Zeitfenster ab `now()`.
- 12 h → ICON-CH1 (höhere Auflösung, 1 km, bis +33 h)
- 24 h → ICON-CH1
- 48 h → ICON-CH2 (Wechsel ab +33 h auf 2 km)

## Architektur

```text
src/routes/_authenticated/
  intern.niederschlag.tsx        ← neue, geschützte Seite (3 Karten + Download-Buttons)

src/lib/
  precip-accum.functions.ts      ← createServerFn: gibt akkumuliertes mm-Grid zurück
  precip-accum.server.ts         ← liest R2-GRIB-Cache, summiert tp pro Pixel

src/components/maps/
  precip-accum-map.tsx           ← Heatmap-Renderer (Canvas) + PNG-Export-Hook
```

Login-Schutz nutzt die bestehende `_authenticated`-Layout-Route (Supabase-Auth muss aktiv sein — siehe „Voraussetzung" unten).

## Komponenten-Details

**`PrecipAccumMap`** — wiederverwendbar, eine Instanz pro Zeitfenster:
- Props: `hours: 12 | 24 | 48`, `title: string`
- Rendert Canvas mit gleicher mm-Farbskala wie Radar (`src/components/maps/radar-map.tsx`)
- Overlay: Thurgau-Grenze (`src/data/thurgau.json`) + Bodensee (`src/data/lake.json`) + Ortspunkte (`src/data/spots.ts`)
- Legende: Farbskala mit mm-Werten (z.B. 0.1 / 1 / 5 / 10 / 20 / 50 mm)
- Button „PNG herunterladen" → `canvas.toBlob()` → Download mit Dateiname `niederschlag-{hours}h-{ISO-Datum}.png`. Die Legende wird ins PNG eingebrannt (Canvas zeichnet Legend on top).

**`/_authenticated/intern/niederschlag`** Seite:
- 3 Karten untereinander (responsive: bei Desktop 2-3 spaltig möglich, aber gestapelt ist klarer für PNG-Vergleich)
- Header mit Lauf-Zeitstempel (ICON-Run + „akkumuliert ab HH:MM Uhr")
- Pro Karte: max mm, Pixel über 1 mm, kurze Statistik
- Kein Sidebar-Eintrag, nicht in `MAPS`-Konfig — nur via Direktlink `/intern/niederschlag`

## Server-Funktion

```ts
// precip-accum.functions.ts
getPrecipAccum({ hours: 12 | 24 | 48 })
  → { generatedAt, runReference, grid: { lats, lons }, values: number[][], maxMm, unit: "mm" }
```

- Memo 60 s im Worker-Isolate (wie `openmeteo-cache.server.ts`)
- Edge-Cache 60 s
- Fehler-Fallback: `{ values: [], error: "..." }` statt Throw

## Voraussetzung: Authentifizierung

Aktuell ist im Projekt **keine Supabase-Auth-Route** vorhanden (`/login` etc. fehlen). Für die „nur intern"-Anforderung braucht es:

1. **Profiles-Tabelle?** → Da nur du Zugriff brauchst, reicht **kein** Profiles-Setup. Einfacher Email/Password-Login genügt.
2. Neue Routen: `/login` (Login-Form) und `/_authenticated.tsx` (Layout-Guard via `beforeLoad` + Supabase `getUser()`)
3. Migration nicht nötig (auth.users genügt)
4. Nach erstem Deploy: Du legst dir manuell einen Account in Lovable Cloud → Users an

**Alternative (einfacher, wenn du keinen Login willst):** Schutz via HTTP-Basic-Auth-Header in einem Server-Route-Middleware ODER simpler Passwort-Gate-Cookie (kein User-Account). Sag bitte, was du bevorzugst — Standard-Empfehlung: Email/Password-Login.

## Build-Reihenfolge

1. Auth-Setup (falls noch nicht vorhanden): `_authenticated.tsx` Layout + `/login`
2. `precip-accum.server.ts` + `.functions.ts` (R2-Read + Akkumulation)
3. `PrecipAccumMap` Komponente mit Canvas-Rendering + PNG-Export
4. Route `/_authenticated/intern.niederschlag.tsx` mit 3 Karten
5. Test: Live-Daten, PNG-Download, Login-Flow

## Offene Frage

Welche Auth-Variante möchtest du — **(a) Email/Password-Login** (sauber, Standard), **(b) einfacher Passwort-Gate-Cookie** (1 Passwort für alle, kein Account), oder **(c) IP/Token-Schutz via URL-Param** (`?token=xyz`)?
