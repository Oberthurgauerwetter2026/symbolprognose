## Suchleiste noch transparenter machen

Ziel: Die Suchleiste in der Regionskarte (`src/components/region-map.tsx`) soll noch mehr durchscheinen, damit sie sich noch besser in die Karte einfügt.

### Änderungen

1. **Deckkraft weiter reduzieren**
   - Hintergrund der `MapSearchBar` von `bg-primary/45` auf `bg-primary/30` senken.
   - Schatten leicht anpassen (z. B. `shadow-sm` statt `shadow-md`), damit die Leiste bei geringerer Deckkraft nicht schwebend/unnatürlich wirkt.

2. **Lesbarkeit prüfen**
   - Kurzer visueller Check, ob der weiße Text auf dem noch transparenteren blauen Hintergrund weiterhin gut lesbar bleibt – insbesondere auf hellen und dunklen Kartenbereichen.

### Betroffene Datei
- `src/components/region-map.tsx`
