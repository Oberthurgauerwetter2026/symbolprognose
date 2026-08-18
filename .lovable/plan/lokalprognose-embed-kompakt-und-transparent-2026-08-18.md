# Lokalprognose-Embed kompakt und transparent

## Ziel
Nur noch ein Lokalprognose-Snippet anbieten. Ohne gewählten Ort soll es nur die kompakte Ortssuche zeigen, keinen grauen Hintergrund und keine unnötige Leerhöhe.

## Umsetzung
1. **Doppeltes Snippet entfernen**
   - „Lokalprognose mit Ortssuche (Auto-Höhe)“ aus der Snippet-Seite entfernen.
   - „Lokalprognose (wie Original)“ als einziges allgemeines Lokalprognose-Snippet behalten.
   - Die alte Embed-Route nicht mehr als Produkt anbieten; bestehende externe Einbindungen werden dadurch nicht unnötig kaputtgemacht.

2. **Hintergrund vollständig transparent machen**
   - Den im iframe-Snippet fest gesetzten grauen Hintergrund entfernen.
   - Im Original-Lokalprognose-Embed den grauen Widget-Hintergrund nur für diesen transparenten Embed-Kontext überschreiben, ohne die normale Website zu verändern.
   - Auch Lade- und Fallback-Zustände transparent halten.

3. **Startzustand auf tatsächliche Inhaltshöhe begrenzen**
   - Die Start-Höhe des einzigen Snippets an Suchfeld plus Hinweis ausrichten.
   - Nur eine verlässliche Höhenquelle verwenden, damit sich doppelte Höhenmeldungen von Widget und Embed-Hülle nicht gegenseitig beeinflussen.
   - Verkleinerungen nach stabiler Messung zulassen und die Mindesthöhe so niedrig halten, dass unter dem Hinweis keine leere Fläche bleibt.

4. **Responsive prüfen**
   - Den Zustand ohne Ort auf Desktop und Mobile prüfen: transparent, kompakt und ohne abgeschnittenen Inhalt.
   - Danach einen Ort auswählen und prüfen, dass das iframe automatisch auf die vollständige Prognose wächst und beim Zurücksetzen wieder schrumpfen kann.

## Technische Details
- Betroffene Bereiche: Snippet-Generator, Original-Lokalprognose-Route, `WeatherWidget`-Embeddarstellung und Höhenkommunikation.
- Die normale Lokalprognose außerhalb des Embeds bleibt optisch und funktional unverändert.