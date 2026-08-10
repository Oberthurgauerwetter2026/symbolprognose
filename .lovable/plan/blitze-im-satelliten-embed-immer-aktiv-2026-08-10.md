Blitze im Satelliten-Embed immer aktiv

Im Embed `/embed/satellit-loop` wird `SatelliteMap` mit `loop` und `bare` gerendert. Dabei ist die Steuerleiste (inkl. Blitz-Schalter) ausgeblendet. Der Blitz-Status (`showLightning`) liest aktuell den Wert aus `localStorage` (`sat.lightning`) und fällt nur auf aktiv zurück, wenn nichts gespeichert ist. Wenn ein Besucher die Blitze auf der Hauptseite ausgeschaltet hat, sind sie auch im Embed deaktiviert — die Nutzeranforderung ist: im Embed sollen Blitze immer aktiv sein.

Geplante Änderung:
- `SatelliteMap` um einen optionalen Prop `lightningInitiallyActive?: boolean` erweitern.
- Wenn dieser Prop übergeben wird, setzt er den Initialwert von `showLightning` und überschreibt damit den `localStorage`-Wert nur für diese Komponenteninstanz.
- Im Embed-Route `src/routes/embed.satellit-loop.tsx` wird `<SatelliteMapLazy bare loop lightningInitiallyActive />` übergeben.
- Der `localStorage`-Wert wird weiterhin in der Hauptansicht verwendet, um die Benutzereinstellung zu erhalten.
- Keine Änderung am Schalter-Verhalten: wer die Hauptseite aufruft, behält sein vorheriges Setting.

Betroffene Dateien:
- `src/components/maps/satellite-map.tsx`
- `src/routes/embed.satellit-loop.tsx`

Validierung:
- Build/Typecheck erfolgreich.
- Im Embed-Preview werden Blitze standardmässig angezeigt, unabhängig vom lokalen Speicherzustand der Hauptseite.
