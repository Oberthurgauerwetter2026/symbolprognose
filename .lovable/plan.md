# Plan: "Warnungen verwalten" als eigenen Sidebar-Menüpunkt

## Ziel
Den Direktlink zur Warnungsverwaltung (`/admin-warnungen`) direkt in der App-Sidebar als prominenten, immer sichtbaren Menüpunkt platzieren, damit die URL nicht mehr auswendig gelernt werden muss.

## Aktueller Zustand
- `src/components/app-sidebar.tsx` zeigt im Bereich „Werkzeuge“ nur die Punkte „Embed-Snippets“ und „Admin“.
- Der Link zum Warnungen-Erfassen (`/admin-warnungen`) ist bisher nur über Direktaufruf oder über das Admin-Submenü (falls vorhanden) erreichbar.

## Geplante Änderungen

### 1. Neuer Menüpunkt in `src/components/app-sidebar.tsx`
- Unterhalb der bestehenden „Admin“-Zeile im Bereich „Werkzeuge“ einen neuen Punkt „Warnungen verwalten“ hinzufügen.
- Link-Ziel: `/admin-warnungen`.
- Icon: `BellRing` aus `lucide-react` (passend zur Warnungsthematik).
- Aktiv-Zustand: `isActive("/admin-warnungen")`.
- Tooltip: „Warnungen verwalten“.

### 2. Icon-Import ergänzen
- Import in Zeile 2 um `BellRing` erweitern.

### 3. Design-Abgleich
- Gleiche Styling- und Struktur-Konventionen wie die bestehenden Menüpunkte verwenden (`SidebarMenuItem`, `SidebarMenuButton`, `Link`, `truncate`).
- Keine neuen Farben, kein Hardcoding – bestehende shadcn/ui-Sidebar-Tokens nutzen.

## Nicht im Scope
- Keine Änderung an der Admin-Route `/admin` selbst.
- Keine neue Route oder Logik für die Warnungsverwaltung (existiert bereits in `/admin-warnungen`).
- Keine Backend- oder RLS-Änderungen.

## Validierung
- Nach der Änderung wird die Sidebar im Preview geprüft: Menüpunkt sichtbar, Link führt zu `/admin-warnungen`, aktiver Zustand funktioniert.
