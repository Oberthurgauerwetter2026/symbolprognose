Kleines UI-Redesign der Warninfo-Box in `src/components/maps/warn-map.tsx`:

1. **Auswahl aufheben → X-Button**
   - Den aktuellen Text-Link „Auswahl aufheben“ entfernen.
   - Im Info-Panel-Header eine Header-Zeile mit dem Ortsnamen links und einem `X`-Icon-Button (bereits importiert) rechts anzeigen.
   - Der X-Button löst die bisherige `setSelected(null)`-Aktion aus.

2. **Ortschaft oben belassen**
   - Der `h2`-Titel behält den ausgewählten Gemeindenamen (`regionName(selected)`) bzw. „Region Oberthurgau“ im Grundzustand.

3. **Ortschaft unten entfernen**
   - Die letzte Zeile in jeder Warnmeldung, die die betroffenen Gemeinden auflistet, entfernen.
   - Optional: Das Badge „automatisch (Radar)“ bei Auto-Warnungen separat erhalten (z. B. neben der Gültigkeitszeit oder als kleines Tag), falls es weiterhin sichtbar sein soll.

**Technische Details**
- Datei: `src/components/maps/warn-map.tsx`.
- Keine neuen Imports nötig; `X` ist bereits in Zeile 7 importiert.
- Anschließend TypeScript-Check und visuelle Verifikation via Preview-Screenshot.
