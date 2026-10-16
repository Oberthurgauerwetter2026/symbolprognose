# Regentropfen besser sichtbar machen

The drops are light blue (#69b7e8) with a thin, mid-blue outline. On grey clouds they barely stand out.

## Fix
- Make the drop color a deeper, more saturated blue (about #2f8fe0) so it stands out from grey.
- Give the outline a dark navy color (about #0b3a6b) and make it slightly thicker (0.7 → 1.0).
- Keep the small white shine on each drop, which reads like a highlight.
- Make the change the same everywhere: in the app, on all embeds and in the server-drawn symbols (push messages and embeds without scripts).

Drop shape, size and the falling animation stay unchanged.

## Technical
- `src/styles.css`: `--wx-drop`, `--wx-drop-edge`
- `src/components/weather-icons/index.tsx`: fallback colors, stroke-width
- `src/lib/weather-icon-svg.server.ts`: line 98 and the CSS variables on line 473
