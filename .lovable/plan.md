## Ziel

Die farbigen Marker-Pills (Icon + Ortsname + Temperatur) auf `/karten/region` durch einen moderneren, zeitgemässen helleren, "frosted glass"-Look ersetzen. Die Karte soll durch die Pille schimmern, Lesbarkeit bleibt durch dunklen Text und feinen Rand erhalten.

## Änderungen

**Datei:** `src/components/region-map.tsx` — Funktion `MarkerPill` (Z. 144–249)

- Hintergrund: `rgba(255,255,255,0.55)` statt `BRAND`
- `backdrop-filter: blur(14px) saturate(140%)` (nur Standard-Property, kein hand-geschriebenes `-webkit-` Prefix — sonst killt Lightning CSS den Effekt in Production)
- Rand: `1px solid rgba(255,255,255,0.7)`
- Schatten dezenter: `0 4px 14px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)`
- Textfarben auf dunkel umstellen:
  - Ortsname (Uppercase-Label): `rgba(15,23,42,0.65)`
  - Min-Temp (daily): `rgba(15,23,42,0.6)`
  - Slash-Trenner: `rgba(15,23,42,0.35)`
  - Max-Temp / Now-Temp: `#0f172a`
- Icon-Größe und Padding unverändert (40px Icon, `8px 16px 8px 10px`)
- `BRAND`-Import bleibt erhalten (wird woanders verwendet), nur die Pill-Stelle wird umgestellt

## Hinweise

- Weather-Icons nutzen `currentColor` nicht — die `--wx-*` Tokens sind eigenständig, also bleiben Icons farblich gleich und kontrastieren weiterhin auf hellem Glas.
- Kein anderer Code, kein neues Token, keine Logik-Änderung.
- Nach dem Build kurz auf der Karte gegenprüfen, ob der Blur in Chrome sichtbar ist (Production-Test).