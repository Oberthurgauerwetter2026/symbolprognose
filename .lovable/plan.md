Plan:

1. Scrubbing wirklich auf die sichtbaren Filmstrip-Stufen snappen
- In `FilmstripTimeline` beim Ziehen nicht mehr die kontinuierliche Zielzeit (`target`) anzeigen.
- Stattdessen die nächstgelegene Frame-Zeit aus der bereits reduzierten `frames`-Liste verwenden.
- Dadurch springen Bubble, Tageslabel und Slider-Position beim Scrubben nur noch in den erlaubten Takten:
  - Messung: 5 Minuten
  - Prognose erste 24h: 15 Minuten
  - Prognose danach: 1 Stunde

2. Bubble/Banner nach Frame-Typ einfärben
- Eine kleine Hilfsfunktion für Timeline-Farben nutzen:
  - Messung: Grün
  - Prognose: Blau
- Die Filmstrip-Bubble inklusive Pfeil bekommt die Farbe des aktuell gesnappten Frames.
- Das obere Quellen-Banner und die Datums-/Zeit-Anzeige werden gemeinsam in Messung grün bzw. Prognose blau dargestellt.

3. Filmstrip-Band anpassen
- Das Messungs-Band im Filmstrip von grau auf grün ändern.
- Das Prognose-Band bleibt blau.
- Damit sind Banner, Bubble und Filmstrip konsistent: Messung grün, Prognose blau.

4. Validierung
- Typecheck ausführen.
- Auf `/karten/radar` prüfen, dass beim Scrubben keine 1-Minuten-Zwischenwerte mehr erscheinen und die Farben bei Messung/Prognose korrekt wechseln.