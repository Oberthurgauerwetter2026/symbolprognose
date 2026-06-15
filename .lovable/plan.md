## Lokalprognose: Temperaturen in Tageskacheln umgekehrt darstellen

### Änderung
In den 7-Tage-Tageskacheln der Lokalprognose werden Minimum und Maximum vertauscht und in unterschiedlicher Schriftstärke präsentiert:

- **Links:** Tagesminimum – schmaler, leichter (`font-medium text-zinc-600`), kleinere Größe (`text-base`).
- **Rechts:** Tagesmaximum – fett, prominent (`font-bold text-zinc-900`), größere Größe (`text-xl` / `@[1100px]:text-2xl`).

### Datei
`src/components/weather-widget.tsx` (Zeilen 569–575)

### Technische Details
- Die Daten bleiben unverändert: `temperature_2m_min` und `temperature_2m_max` aus dem API-Response.
- Keine Farben, keine Pfeile – rein typografisch differenziert.
- Keine weiteren UI-Änderungen in den Kacheln.