Horizontale Scroll-Schatten dezenter gestalten

## Ziel
Die soeben eingeführten horizontalen Rand-Schatten an den Prognose-Scrollern sollen noch dezenter wirken, damit sie den Inhalt weniger überlagern.

## Betroffene Bereiche
- `src/components/ui/scroll-edge-shadows.tsx` – zentrale Scroll-Rand-Komponente.
- Alle Verwendungsstellen (Lokalprognose, Regionskarte) profitieren automatisch.

## Geplante Änderung
- Deckkraft der Gradienten von `from-foreground/15` auf `from-foreground/7` halbieren.
- Breite der Fade-Zone von `w-5` (20 px) auf `w-4` (16 px) leicht reduzieren.
- Übergangszeit bleibt bei 150 ms.
- Keine Änderung an der Scroll-Logik, Snap-Verhalten oder an den übergeordneten Containern.

## Prüfung
- Visuell auf `/karten/lokal` und `/karten/region` bei Smartphone-Breite prüfen.
- Sicherstellen, dass Schatten weiterhin nur bei tatsächlichem Overflow erscheinen und beim Wischen nach links/rechts korrekt ein-/ausblenden.
