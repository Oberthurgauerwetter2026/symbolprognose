## Ziel
Der Installationsname der Warnkarte-App (Home-Bildschirm / Android) soll von „OT Wetter“ auf „Wetterwarnungen“ geändert werden. Das Haupt-App-Manifest bleibt unverändert.

## Änderungen
1. **public/warnkarte.webmanifest**
   - `short_name`: `"OT Wetter"` → `"Wetterwarnungen"`
   - `name` bleibt „Oberthurgauer Wetter“, da der Benutzer explizit nur den kurzen Installationsvorschlag anpassen wollte.

2. **src/routes/warnkarte.tsx**
   - `apple-mobile-web-app-title`: `"Oberthurgauer Wetter"` → `"Wetterwarnungen"`
   - Damit stimmt der iOS-Home-Screen-Name mit dem Android/Manifest-Kurznamen überein.

## Nicht geändert
- `public/manifest.webmanifest` (Haupt-App) behält „OT Wetter“.
- Icons, Theme-Farben, Scope und Start-URL bleiben gleich.

## Validierung
- Webmanifest JSON-Syntax prüfen.
- Route in der Vorschau kurz öffnen, um sicherzustellen, dass der Meta-Tag korrekt gesetzt ist.