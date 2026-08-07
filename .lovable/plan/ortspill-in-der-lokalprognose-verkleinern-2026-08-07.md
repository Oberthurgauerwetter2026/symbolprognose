# Ortspill in der Lokalprognose verkleinern

## Ziel

Die aktuelle Akzent-Pille für den ausgewählten Ort in der Lokalprognose soll dezent kleiner wirken, ohne ihre Prominenz und Lesbarkeit zu verlieren.

## Änderung

1. In `src/components/weather-widget.tsx` (Zeile ~570–575) wird die Orts-Pille leicht verkleinert:
   - Schriftgrösse von `text-lg` auf `text-sm` oder `text-base` reduzieren.
   - Schriftgewicht von `font-bold` auf `font-semibold` leicht zurücknehmen.
   - Padding von `px-3 py-1` auf `px-2.5 py-0.5` verringern.
   - MapPin-Icon bleibt erhalten; optional auf `h-3.5 w-3.5` reduzieren.
   - Form, Akzentfarbe, Schatten und abgerundete Pille bleiben erhalten.

## Technische Hinweise

- Betroffene Datei: `src/components/weather-widget.tsx` (nur die Orts-Pille im Header).
- Keine Änderung an Daten, Server-Funktionen oder Routing.
- Tailwind-only, keine neuen Abhängigkeiten.

## Prüfung

- Lokalprognose in Desktop- und Mobile-Ansicht öffnen, Ort wählen.
- Sicherstellen, dass die Pille kleiner, aber klar lesbar ist und im Header nicht übermässig Raum einnimmt.
- Typecheck und Build laufen durch.
