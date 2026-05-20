## Schriftart-Wechsel: Sora + Manrope

Du hast nur nach der Schriftart gefragt — ich beschränke den Plan bewusst darauf. Farbpalette und Layout bleiben unverändert (können wir in einem späteren Schritt angehen, falls gewünscht).

### Auswahl

- **Headings / Display:** Sora (geometrisch, modern, digital-präzise)
- **Body / UI:** Manrope (humanistisch, sehr gut lesbar in kleinen Grössen — wichtig für die vielen Zahlen, Zeitangaben und Labels im Widget)

Beide sind Open-Source-Google-Fonts und ersetzen das jetzige Inter vollständig.

### Änderungen

**1. `src/routes/__root.tsx` — Font-Stylesheet**
Die Google-Fonts-URL wird ersetzt:
```
family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700
```
(Inter und JetBrains Mono entfallen — Mono wird im UI nirgends benutzt.)

**2. `src/styles.css` — Theme-Tokens**
- `--font-sans` → `"Manrope", ui-sans-serif, system-ui, sans-serif`
- Neu: `--font-display` → `"Sora", ui-sans-serif, system-ui, sans-serif`
- `--font-mono` entfernen (ungenutzt)

**3. `src/components/weather-widget.tsx` — Display-Font anwenden**
Headlines bekommen `font-[family-name:var(--font-display)]`:
- Ortsname / aktuelle Temperatur (Hero-Bereich)
- Tagesnamen-Header in der 7-Tage-Übersicht
- Detail-Panel-Titel
- Embed-Info-Seiten-Titel

Alle Mess- und Tabellentexte bleiben Manrope (bessere Ziffern-Lesbarkeit auf 10–12 px).

### Was unverändert bleibt

- Farben (Accent-Blau bleibt)
- Layout, Spacing, Border-Radius
- Bento- oder andere Strukturänderungen
- Komponenten-Logik

### Vorher / Nachher

Vorher: Inter überall — eine Schrift für alles, neutral, austauschbar.
Nachher: Sora trägt die Headlines mit etwas Charakter und Modernität, Manrope hält die Daten ruhig und lesbar — typische editoriale Trennung Display ↔ Body.