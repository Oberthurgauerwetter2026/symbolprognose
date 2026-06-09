Ziel: Die Lokalprognose muss auf externen Monitoren sichtbar sein, auch wenn der Browser dort JavaScript, moderne CSS/JS-Bundles, postMessage-Resize oder Hydration nicht zuverlässig ausführt.

Plan:

1. **Statische Embed-Route als sichere Hauptlösung**
   - Eine neue, bewusst einfache Route für die Lokalprognose anlegen, z. B. `/embed/region-lokal-static`.
   - Diese Route rendert ausschließlich serverseitigen HTML-Inhalt: aktuelle Werte, nächste Stunden und 7-Tage-Übersicht.
   - Keine interaktive React-Hydration, keine dynamischen Chunks, kein versteckter Fallback, kein `js-ok`-Umschalten.

2. **HTML/CSS monitor-kompatibel machen**
   - Für die statische Route möglichst einfache Klassen/Struktur verwenden und zusätzlich sicherstellen, dass der Inhalt mit weißem Hintergrund und fester Mindesthöhe sichtbar ist.
   - Tabellen/Blöcke so formatieren, dass sie in einem 480px iframe sofort Inhalt oben anzeigen und bei größerer Höhe sauber weiterlaufen.

3. **Embed-Snippet umstellen**
   - Das Snippet auf `/embed-info` für „Lokalprognose Amriswil“ auf die neue statische Route ändern.
   - Den blauen Wrapper-Hintergrund im Snippet durch Weiß bzw. neutralen Hintergrund ersetzen, damit selbst bei Ladeproblemen kein leerer blauer Bereich erscheint.
   - `scrolling="auto"` bzw. eine einfache statische Höhe verwenden, damit Monitore ohne funktionierendes `postMessage` den Inhalt trotzdem scrollbar/anzeigen können.

4. **Bestehende interaktive Route behalten**
   - `/embed/region-lokal` bleibt bestehen, falls sie in normalen Browsern weiter genutzt wird.
   - Die neue statische Route wird aber als empfohlener Code für externe Monitore verwendet, weil sie deutlich weniger fehleranfällig ist.

5. **Verifikation**
   - Die veröffentlichte/statische Ausgabe per HTML/Screenshot prüfen: Inhalt muss ohne Client-JavaScript sichtbar sein.
   - Prüfen, dass `/embed-info` den neuen, robusten Einbettungscode ausgibt.