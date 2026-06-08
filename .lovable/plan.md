Ich passe den Radar so an, dass die Modellprognose im Radar wirklich bei den nächsten 24 Stunden endet.

Plan:
1. `src/lib/radar.functions.ts`
   - Den Prognose-Cutoff abhängig vom Aufrufer setzen:
     - normaler Radar: `now + 24h`
     - Niederschlagssummen mit `extended: true`: `now + 48h`
   - Damit werden im Radar bereits serverseitig keine ICON-CH1-Frames nach +24h mehr ausgeliefert.
   - CH2 bleibt weiterhin nur bei `extended: true` aktiv.

2. `src/components/maps/radar-map.tsx`
   - Zusätzlich clientseitig absichern: Radar-Frames nach +24h werden für Timeline/Animation herausgefiltert, falls noch alte gecachte Daten im Browser liegen.
   - Die Timeline endet dadurch sichtbar bei +24h, auch bevor sich alte Query-Caches vollständig erneuern.
   - Footer bleibt bei `ICON-CH1 (Vorhersage bis +24 h)`.

3. `src/routes/karten.niederschlag.tsx`
   - Unverändert `extended: true` beibehalten, damit die Niederschlagssummen weiterhin 48h bekommen.

4. Prüfung
   - Radar-Route `/karten/radar`: letzter Prognose-Frame maximal +24h.
   - Niederschlags-Route `/karten/niederschlag`: 48h-Summen bleiben verfügbar.