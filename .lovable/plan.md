## Ziel

1. Niederschlags-Karten (`/intern/niederschlag`) optisch modernisieren.
2. PNG-Download zuverlässig zum Laufen bringen.

---

## 1) Download reparieren

**Vermutete Ursache:** Im Lovable-Preview-Iframe sind Downloads via `<a download>` häufig blockiert (iframe ohne `allow-downloads`-Sandbox). `canvas.toBlob()` + Object-URL kann zusätzlich an Grösse / DPR scheitern (Canvas wird mit `dpr` skaliert → bei dpr=2 ist das interne Canvas 2400×1440).

**Fix in `src/components/maps/precip-accum-map.tsx`:**
- Für den Export ein **separates 1200×720 Offscreen-Canvas** rendern (ohne DPR-Skalierung) → kleinere, vorhersagbare PNG-Grösse, kein Tainting-Risiko.
- Primär `canvas.toBlob` → `URL.createObjectURL` + Anchor-Klick.
- **Fallback:** wenn Blob null oder Klick in Sandbox blockiert → `toDataURL("image/png")` in neuem Tab öffnen (`window.open(dataUrl, "_blank")`), damit der User per Rechtsklick → Speichern laden kann.
- Toast (`sonner`) für Erfolg / Fehler.
- Hinweis-Text unter Button: „Falls Download im Vorschau-Fenster blockiert wird, öffnet sich das Bild in einem neuen Tab."

## 2) Darstellung modernisieren

Beibehalten: Datenquelle, Akkumulationslogik, Farbskala-Bedeutung (mm-Stufen).

Visuell überarbeiten:
- **Karten-Kacheln:** weisser Card-Container mit weichem Schatten, abgerundete Ecken (`rounded-xl`), klare Section-Header statt nackter `h2`. Drei Karten als responsive Grid statt vertikale Liste (auf grossen Screens 1 Spalte, da Karte breit ist; Header-Block mit Stats + Button rechts).
- **Canvas-Hintergrund:** statt grau-blass `#f5f7fa` → sauberes Weiss mit subtilem Rahmen. Schweiz als hellgraue Fläche, Nachbarländer leicht abgesetzt.
- **Typografie im Canvas:** modernere Hierarchie — grosser, fetter Titel („+12 h Niederschlag"), darunter kleinerer Untertitel mit Zeitfenster. Tabular-nums für Zahlen.
- **Heatmap:** Farbskala beibehalten, aber Übergänge **weicher (linear interpoliert zwischen Stufen)** statt harter Bänder → modernere, MeteoSchweiz-ähnliche Optik. Optional sehr leichter Blur (1 px) auf der Heatmap-Ebene.
- **Thurgau-Outline:** kräftiger, mit leichtem Schatten/Halo, damit es auf weissem Hintergrund pop't.
- **Spots/Labels:** Pill-förmige Labels mit weissem Hintergrund + 1 px Border statt Text mit Halo → bessere Lesbarkeit.
- **Legende:** horizontales Farbband mit kontinuierlichem Gradient (statt diskreter Blöcke), darunter mm-Werte mittig ausgerichtet. Max-Wert + Modell-Mix als kleine „Chips" links.
- **HTML-Header der Seite:** echter Page-Header mit Untertitel, kleiner Live-Indikator (grüner Punkt + „aktualisiert vor X min"), Auto-Refresh-Anzeige.

## Technische Details

Geänderte Dateien:
- `src/components/maps/precip-accum-map.tsx`
  - Render-Pipeline trennen: `renderMapToCanvas(ctx, size, ...)` mit Parameter statt fester Konstanten; Display-Canvas nutzt DPR, Export-Canvas nutzt 1×.
  - Neue Hilfsfunktion `colorForAccumSmooth(mm)` mit linearer Interpolation zwischen `ACCUM_SCALE`-Stufen.
  - Legenden-Rendering auf Gradient (`createLinearGradient`) umstellen.
  - Card-Wrapper im JSX (shadcn `Card` aus `@/components/ui/card`).
  - Toast via `sonner` (bereits im Projekt).
- `src/routes/intern.niederschlag.tsx`
  - Header-Sektion modernisieren (Titel, Untertitel, Live-Indikator basierend auf `dataUpdatedAt`).
  - Karten in `space-y-6`-Stack mit Cards.

Keine Änderungen an: Server-Funktionen, Datenquellen, Auth-Flow, Routing.

## Out of scope

- Keine Public-Route, kein Sidebar-Eintrag.
- Keine Änderung an ICON-Cache / R2.
- Keine Server-side PNG-Generierung (Client-Canvas reicht).
