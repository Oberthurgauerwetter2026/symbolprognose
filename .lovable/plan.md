# Radar: einheitlicher Stil + Daten-Stillstand klären

## 1. Warum endet die Radarmessung am 26.5.2026 um 00:15 Uhr?

Diagnose direkt an den Quellen geprüft:

- **Radar-Manifest in R2** (`/radar/frames.json`):
  - `generatedAt`: **2026-05-25 22:19 UTC**
  - letzter Frame: **2026-05-25 22:15 UTC** = 26.5.2026 **00:15 lokal**
- **Open-Meteo-Cache** (`/openmeteo/forecast.json`):
  - `generatedAt`: 2026-05-26 09:04 UTC (vor ~4,5 h, sollte alle 5 min sein)

Beide Hintergrund-Jobs in GitHub Actions liefern also keine frischen Daten mehr:
- `radar-ingest.yml` ist seit ca. 17 h tot → kein neues MeteoSchweiz-Radar-PNG
- `openmeteo-ingest.yml` läuft nicht im 5-Min-Takt → ICON-CH1-Vorhersage altert ein

Das ist **kein Frontend-Bug**, sondern ein Infra-Problem. Wahrscheinliche Ursachen:
1. GitHub deaktiviert Cron-Workflows nach 60 Tagen Repo-Inaktivität automatisch.
2. Workflow ist fehlgeschlagen (z.B. R2-Credentials abgelaufen, MeteoSchweiz-Endpoint geändert) und seitdem disabled.

**Nächster Schritt zum Fix (manuell durch dich):**
- In GitHub → Actions → `radar-ingest` + `openmeteo-ingest` öffnen, prüfen ob sie "disabled" sind, ggf. **Re-enable** + manueller "Run workflow" anstossen.
- Letzten fehlgeschlagenen Run anschauen → Fehlermeldung melden, dann fixe ich das Script.

Ich kann hier am Code nichts reparieren, bis ich weiss, woran der Workflow scheitert.

## 2. Toolbar & Zeitslider an Region-Karte angleichen

Vorbild: Pill-Group im Region-Header (`#2561a1`-Indicator, weisser Text aktiv, `text-foreground hover:bg-foreground/5` inaktiv) + Slider-Bubble mit blauem Hintergrund und Pfeil.

### Datei `src/components/maps/radar-map.tsx`

**Toolbar (Zeilen ~714–777):**
- Play/Pause + Jetzt + Speed (1×/2×/4×) in **eine** Pill-Group `rounded-full bg-muted p-1` zusammenfassen, identisch zur Day-Pill in Region (`relative z-10 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold transition-colors`).
- Aktiver Zustand: `text-white` mit blauem Indicator-Background `style={{ background: BRAND }}` (für Play wenn `playing`, für Speed-Wert).
- Inaktiv: `text-foreground hover:bg-foreground/5`.
- Hagel-Button bleibt rechts (`ml-auto`), aber gleicher Pill-Look: `rounded-full px-3 py-2 text-xs font-semibold`; aktiv = `bg-[#2561a1] text-white`, inaktiv = `text-foreground hover:bg-foreground/5`, disabled = `opacity-60 cursor-not-allowed`.
- `Button`-Komponenten aus shadcn werden durch native `<button>` ersetzt, damit der Stil 1:1 wie Region ist (Region nutzt ebenfalls native Buttons).

**Timeline-Bubble (Zeilen ~509–521):**
- Bubble-Background: `bg-foreground text-background` → **`background: BRAND`, `text-white`**.
- Bubble-Form: `rounded-md px-2.5 py-1 text-xs font-semibold shadow-md` (wie Region Tooltip).
- Pfeil unter Bubble: separates `<div>` mit `border-top: 5px solid BRAND` (statt `after:border-t-foreground`), exakt wie Region.
- Format des Datums leicht anpassen an Region-Tooltip-Stil: `"Prognose: Di, 17:00"` → für Radar sinnvoller `"Di 26.05., 15:30"` (Datum behalten, da Radar mehrere Tage abdeckt).

**Handle (Zeilen ~510–513):**
- Handle bereits `border-2 bg-background`; `borderColor: BRAND` schon gesetzt → ok. Schatten leicht stärken: `shadow-md`.

**Track-Range (Zeilen ~483–499):**
- Vergangenheits-Segment bleibt `bg-muted-foreground/25`.
- Vorhersage-Segment: bisher `hsl(212 60% 55% / 0.45)` → ersetzen durch `color-mix(in oklab, ${BRAND} 35%, transparent)` damit es zum Brand-Blau passt.
- "Jetzt"-Linie: `bg-foreground/60` → `background: BRAND`, `width: 1.5px`.

**Tick-Labels (Zeilen ~442–454):**
- `h===0` ("Jetzt"): `font-semibold` mit `color: BRAND` statt `text-foreground`.

### Keine Logik-Änderung
Play-Loop, Idx-Berechnung, Frame-Sortierung, Tastatur-Steuerung bleiben unverändert. Reine Optik.

## Reihenfolge

1. Frontend-Refresh umsetzen (Schritt 2) — sofort möglich.
2. Du re-enabled die zwei GitHub-Workflows; falls sie failen, schickst du mir den Log-Auszug, dann fixe ich den Ingest.
