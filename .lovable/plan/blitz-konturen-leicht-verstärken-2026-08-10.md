Blitz-Konturen leicht verstärken

Aktuell haben die Blitz-Symbole in `src/components/maps/lightning-bolt.ts` und `src/components/maps/satellite-map.tsx` eine schwarze Kontur mit `outlineWidth: 1.5`. Die Nutzer-Rückmeldung lautet: "noch etwas dickere Linien".

Geplante Änderung:
- `outlineWidth` in `BOLT_YELLOW` und `BOLT_RADAR` von `1.5` auf `2.5` erhöhen.
- Die zwei inline `BoltColors` im `satellite-map.tsx` (Orange/Rot für ältere Blitze) ebenfalls von `1.5` auf `2.5` anpassen.
- Keine Änderung an Glow, Farbe oder Geometrie; nur die sichtbare schwarze Kontur wird kräftiger, damit die Blitze vor hellen und dunklen Kartenhintergründen besser lesbar bleiben.

Betroffene Dateien:
- `src/components/maps/lightning-bolt.ts`
- `src/components/maps/satellite-map.tsx`

Validierung:
- Build/Typecheck muss erfolgreich sein.
- Im Preview sollten Radar- und Satelliten-Blitze eine deutlichere schwarze Umrandung zeigen, ohne übermässig klobig zu wirken.
