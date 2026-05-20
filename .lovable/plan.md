## Schrift auf Outfit + Figtree umstellen

Sora/Manrope werden durch das weichere Paar ersetzt:

- **Display:** Outfit (rund, freundlich, geometrisch-weich)
- **Body:** Figtree (humanistisch, warm, sehr lesbar bei kleinen Grössen)

### Änderungen

**1. `src/routes/__root.tsx`** — Google-Fonts-Link:
```
family=Outfit:wght@500;600;700&family=Figtree:wght@400;500;600;700
```

**2. `src/styles.css`** — Theme-Tokens:
- `--font-sans` → `"Figtree", ui-sans-serif, system-ui, sans-serif`
- `--font-display` → `"Outfit", ui-sans-serif, system-ui, sans-serif`

Die `font-[family-name:var(--font-display)]`-Klassen auf den Headlines bleiben unverändert — sie greifen automatisch die neue Display-Schrift.

### Unverändert

Farben, Layout, Komponenten-Logik, alle Grössen und Gewichte.