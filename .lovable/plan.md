## Änderung

In `src/components/weather-widget.tsx` (Z. 508–510) den Untertitel entfernen:

```tsx
<span className="text-xs text-zinc-700 font-medium hidden sm:inline">
  3h · Temperatur °C · Wind / Böenspitzen km/h
</span>
```

→ ersatzlos löschen. Die umgebende `flex justify-between`-Header-Zeile bleibt; links steht weiterhin der Wochentag.
