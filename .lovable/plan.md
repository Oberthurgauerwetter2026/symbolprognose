## Warnkarte: Symbole, Hover und Legende überarbeiten

### 1. Hover-Schattierung der Regionen
In `src/components/maps/warn-map.tsx` beim `mouseover` zusätzlich zur dickeren Kontur eine leichte Abdunklung setzen (z. B. `fillOpacity` +0.15 und dunklerer Rand); `mouseout` stellt den normalen Stil wieder her. Zusätzlich Touch-Unterstützung: auf Mobilgeräten wird beim Antippen die Region ohnehin selektiert – der ausgewählte Zustand bekommt ebenfalls die leichte Schattierung.

### 2. Neue/schönere Gefahren-Symbole (`src/components/warnings/hazard-icons.tsx`)
- **Strassenglätte**: klassisches Verkehrszeichen-Motiv – Auto von hinten/seitlich mit zwei geschwungenen Schleuderspuren darunter, sauber gezeichnet im Lucide-Stil.
- **Schneeflocken**: drei echte 6-strahlige Kristalle mit Seitenästen statt schlichter Sterne, unterschiedliche Grössen, versetzt angeordnet.
- **Regentropfen**: drei plastischere Tropfen (klassische Tropfenform mit Spitze oben, gefüllt statt nur Kontur), diagonal versetzt.
- **Blitz**: markanterer, gefüllter Zickzack-Blitz mit ausgewogener Silhouette.

### 3. Symbolgrössen
Icons in der Gefahren-Bannerleiste von `h-5 w-5` auf `h-7 w-7` (mobil `h-6 w-6`) vergrössern; ebenso die Symbole im Info-Panel/Warnkarten-Liste entsprechend anheben, damit alles konsistent grösser wirkt.

### 4. Legende
Der Auslöser unten links wird zu einem runden Icon-Button mit nur „i“ (kein Text „Legende“) und geringerer Deckkraft (z. B. `bg-card/60`, beim Hover voll deckend). Das geöffnete Legenden-Panel bleibt unverändert funktional.

### Technische Notizen
Betroffene Dateien: `src/components/maps/warn-map.tsx`, `src/components/warnings/hazard-icons.tsx`. Die Icons werden auch in Banner/Widgets und im Admin-Tool genutzt – Änderungen wirken dort automatisch mit, die API der Komponenten bleibt gleich.