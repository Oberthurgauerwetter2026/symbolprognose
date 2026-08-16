# Abstürze (weisse Seite) beheben — Fokus Satellitenbild

## Ausgangslage (geprüft)

- Es sind aktuell keine Laufzeitfehler im Vorschau-Protokoll erfasst; die weisse Seite hinterlässt also bisher keine Spur, die ich auslesen kann. Die Ursache ist damit noch **unbestätigt** — Schritt 1 des Plans macht sie sichtbar.
- Nur die drei Lokalprognose-Embeds haben einen Fehler-Auffangbereich (`embed-error-boundary.tsx`). Satellit-, Radar-, Wind-, Region- und Warnkarte haben keinen: ein einziger Renderfehler dort führt heute zwangsläufig zur weissen Seite.
- Das Satellitenbild baut pro Region **18 Zeitschritte** (3 Stunden / 10 Minuten) und hängt für **jeden** Zeitschritt eine eigene Kachel-Ebene dauerhaft in die Karte (`FrameStack`, satellite-map.tsx). Alle 18 bleiben geladen, auch die unsichtbaren. Bei 512-px-Kacheln ist das die grösste Speicherlast der App und ein realistischer Auslöser für einen Tab-Absturz (Browser beendet die Seite → weiss).

## Was umgesetzt wird

### 1. Absturz sichtbar machen statt weisse Seite
- Ein gemeinsamer Fehler-Auffangbereich für alle Kartenansichten (Satellit, Radar, Wind, Region, Warnkarte, Lokalprognose) und für alle Embeds.
- Statt weiss: kurze Meldung „Karte konnte nicht geladen werden“ mit Knopf „Neu laden“ — die restliche Seite bleibt bedienbar.
- Zusätzlich ein Auffangbereich auf oberster Ebene, damit auch ein Fehler ausserhalb der Karte nie in eine leere Seite mündet.

### 2. Absturzursachen protokollieren
- Globale Erfassung von unbehandelten Fehlern und abgebrochenen Hintergrundabfragen (inkl. Seitenname, Aktion, Browser).
- Ablage in einer neuen Backend-Tabelle mit strengen Zugriffsregeln (nur Schreiben anonym erlaubt, Lesen nur für Admin) und Anzeige im Adminbereich unter der bestehenden Diagnose.
- Damit ist beim nächsten Absturz nachvollziehbar, ob es ein Renderfehler oder ein Speicherabbruch des Browsers war.

### 3. Speicherlast des Satellitenbilds senken (Hauptverdacht)
- Nur ein Fenster von Zeitschritten bleibt als Kachel-Ebene in der Karte (aktiver Frame plus wenige Nachbarn); weiter entfernte Ebenen werden entfernt und bei Bedarf neu geladen — die Animation bleibt flüssig, weil in Abspielrichtung vorgeladen wird.
- Kachelgrösse und Überzeichnung für die eingebettete Schlaufe weiter reduzieren.
- Beim Verlassen der Ansicht bzw. bei Unsichtbarkeit werden alle Ebenen sicher freigegeben.

### 4. Nachweis
- Automatisierter Browsertest: Satellitenansicht öffnen, Animation mehrere Durchläufe abspielen, Speicherverbrauch vor/nach messen und protokollieren, damit belegt ist, dass er nicht mehr unbegrenzt wächst.
- Gleicher Test für Radar und Warnkarte als Gegenprobe.

## Technische Details

- Neue Komponente `src/components/app-error-boundary.tsx` (Klassenkomponente mit `componentDidCatch`), eingesetzt in `src/routes/karten.*.tsx`, `warnkarte.tsx`, `embed.*.tsx`; `errorComponent` in `__root.tsx` bleibt als letzte Schicht.
- Fehlerprotokoll: `src/lib/client-errors.functions.ts` (`createServerFn`) schreibt in `public.client_errors`; Migration mit `GRANT INSERT TO anon, authenticated`, `GRANT ALL TO service_role`, RLS aktiv, Insert-Policy offen, Select-Policy über `has_role(auth.uid(),'admin')`. Rate-Begrenzung pro Sitzung im Client.
- `FrameStack` in `src/components/maps/satellite-map.tsx`: `layersRef` wird zu einem LRU-Fenster (`WINDOW_RADIUS`), `mountFrame`/`unmountFrame` gesteuert vom aktiven Index und der Abspielrichtung; `onProgress` meldet weiterhin geladene Indizes, damit Filmstrip und Autoplay-Gate unverändert funktionieren.
- Keine Änderung an Ingest-Skripten, Cron-Worker oder Radar-Prognose-Rendering (Glättung/PNG-Pfad bleibt unangetastet).
