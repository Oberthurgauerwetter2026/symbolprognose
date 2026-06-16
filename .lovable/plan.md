IFS-EPS ist aus dem Merge raus — die UI nennt es aber noch an mehreren Stellen. Diese Texte angleichen (nur Strings, keine Logik):

1. **`src/components/weather-widget.tsx`**
   - Z. 350 (Tooltip): `"ICON-seamless, ECMWF IFS, DWD-MOSMIX"` → `"ICON-seamless, DWD-MOSMIX"`
   - Z. 354 (Footer): dito
   - Z. 1166 (Footer-Zeile): `Tag 6–7: DWD-MOSMIX + ECMWF IFS Ensemble` → `Tag 6–10: DWD-MOSMIX`

2. **`src/components/region-map.tsx`**
   - Z. 914 (Tooltip): `(ICON-seamless, ECMWF IFS, DWD-MOSMIX)` → `(ICON-seamless, DWD-MOSMIX)`
   - Z. 924 (Footer): `Modelle: ICON-seamless, ECMWF IFS, DWD-MOSMIX` → `Modelle: ICON-seamless, DWD-MOSMIX`

3. **`src/routes/karten.lokal.tsx`**
   - Z. 37 (Subtitle): `5-Tage-Prognose · ICON-seamless · ECMWF IFS` → `5-Tage-Prognose · ICON-seamless · DWD-MOSMIX`

4. **`src/components/embeds/lokal-noscript.tsx`**
   - Z. 185: `MeteoSchweiz ICON-seamless & ECMWF IFS via Open-Meteo` → `MeteoSchweiz ICON-seamless via Open-Meteo & DWD-MOSMIX via opendata.dwd.de`

Admin-Seite (`/admin`) ist bereits korrekt (zeigt nur noch ICON-seamless, ICON-CH1, MOSMIX, best_match).
