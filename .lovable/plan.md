# Karten auf wirklich allen Geräten sichtbar machen

## Kurzantwort

Ja — aber nur, wenn die Karte als **Bild** ausgeliefert wird statt als interaktive JS-Karte. Leaflet, MapLibre & Co. brauchen zwingend JavaScript und einen modernen Browser. Wo JS blockiert ist (Adblocker, In-App-Browser, alte Geräte, Reader-Mode, RSS-Reader, Mail-Vorschau), bleibt die JS-Karte zwangsläufig leer.

Die Lösung ist ein **zweigleisiger Embed**: zuerst ein statisches PNG/Snapshot, der per JS gegen die interaktive Karte ausgetauscht wird, sobald sie geladen ist. Funktioniert auch dort, wo JS komplett aus ist.

## Was ich umsetze

### 1) Snapshot-Endpoint pro Karte

Neue Public-Routes unter `src/routes/api/public/snapshot/`:
- `/api/public/snapshot/radar.png`
- `/api/public/snapshot/region.png`
- `/api/public/snapshot/lokal.png`
- `/api/public/snapshot/wind.png` / `pollen.png` (sobald Daten da sind)

Implementierung im Worker (ohne Headless-Browser, der läuft auf Cloudflare nicht):
- **Radar**: aktuellen Radar-Frame aus R2-Cache nehmen, mit einem vorgerenderten Schweizer/TG-Basemap-PNG zusammensetzen (`@cf-wasm/photon` oder reine Canvas-API über `@napi-rs/canvas`-WASM-Build). Output: PNG, `Cache-Control: public, max-age=300`.
- **Region/Lokal**: SVG der Region (`thurgau.json` ist schon im Repo) + Wettersymbole pro Spot serverseitig zu SVG zusammensetzen, als SVG ausliefern (kleiner, scharf, kein Canvas nötig). Browser rendert SVG nativ — auch ohne JS.
- **Wind/Pollen**: solange "Coming soon", einfaches Platzhalter-PNG.

Cache-Strategie: Snapshot wird beim Ingest (Radar alle 5 min, OpenMeteo alle Stunde) mitgeneriert und in R2 abgelegt — der Endpoint streamt nur aus R2. Keine Render-Last pro Request.

### 2) Embed-HTML mit Picture-Fallback

`src/routes/embed-info.tsx` — neue Snippet-Struktur pro Karte:

```html
<div style="position:relative;width:100%;aspect-ratio:16/10;">
  <!-- Immer sichtbar, auch ohne JS -->
  <a href="https://symbolprognose.lovable.app/karten/region" target="_blank">
    <img src="https://symbolprognose.lovable.app/api/public/snapshot/region.png"
         alt="Wetterkarte Region Ostschweiz — aktuelle Prognose"
         loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>
  </a>
  <!-- Wird per JS gegen interaktives iframe ersetzt -->
  <iframe src="https://symbolprognose.lovable.app/embed/region"
          style="position:absolute;inset:0;width:100%;height:100%;border:0;"
          loading="lazy" onload="this.previousElementSibling.style.display='none'">
  </iframe>
</div>
<noscript>
  <!-- Bild bleibt sichtbar, iframe wird vom Browser ignoriert wenn JS aus -->
</noscript>
```

Effekt:
- **JS an, iframe lädt**: interaktive Karte, Bild verschwindet.
- **JS aus / Adblocker blockt iframe**: das `<img>` bleibt sichtbar, Klick öffnet die volle Karte.
- **In-App-Browser / Cloudflare-Challenge**: dito — Bild bleibt, Link funktioniert.
- **RSS-Reader / Mail-Vorschau**: zeigt das Bild.

### 3) Embed-Info-Seite

`/embed-info` erklärt die zwei Varianten:
- **Empfohlen (mit Fallback-Bild)**: das neue Picture+iframe-Snippet — funktioniert überall.
- **Nur interaktiv**: das bisherige iframe-only Snippet, falls jemand bewusst kein Bild will.

Plus Hinweis, dass das Fallback-Bild alle 5 min aktualisiert wird (Radar) bzw. stündlich (Region/Lokal).

### 4) Was unverändert bleibt

- Interaktive Karten, Radar-Timeline, Forecast, Daten-Ingest, Routen `/karten/*` und `/embed/*` — alles bleibt.
- Kein neuer Cron-Job: Snapshot-Generierung hängt sich an den bestehenden Ingest-Workflow.

## Was es kostet

- Einmal Aufwand: Snapshot-Renderer pro Karten-Typ (Radar = Canvas-Composite, Region/Lokal = SVG-Template).
- Etwas mehr R2-Speicher (vernachlässigbar, ein paar hundert KB pro Karte).
- Kein zusätzlicher Worker-Traffic für Besucher — Bilder werden CDN-gecached.

## Ehrliche Grenzen

- Das Snapshot-Bild ist nicht interaktiv (kein Zoom, kein Timeline-Slider). Wer die volle Karte will, klickt den Link.
- Sehr aggressive Blocker, die `*.lovable.app` komplett blocken, blockieren auch das Bild. Dagegen hilft nur ein Reverse-Proxy auf deiner eigenen Domain (`karten.oberthurgauerwetter.ch` → `symbolprognose.lovable.app`). Sag Bescheid, wenn du das willst — separates Thema.

## Reihenfolge der Umsetzung

1. SVG-Snapshot für `region` und `lokal` (schnellster Win, kein Canvas/WASM nötig).
2. Embed-Info-Snippets auf Picture+iframe umstellen.
3. Radar-PNG-Snapshot via Canvas-WASM (Schritt 2 — etwas aufwändiger).
4. Wind/Pollen-Platzhalter.

Soll ich mit Schritt 1+2 starten? Das deckt schon Region und Lokal-Karte ab — die beiden Karten, die du am häufigsten einbettest.
