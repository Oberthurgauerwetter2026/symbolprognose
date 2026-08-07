# Untertitel bei der Warnkarte entfernen

## Ziel

Der Untertitel soll auf beiden Warnkarten-Ansichten entfernt werden.

## Änderungen

1. `src/routes/warnkarte.tsx`
   - Im `<header>` die `<p>`-Zeile mit `{DESC}` entfernen.
   - Die `DESC`-Konstante kann als Export erhalten bleiben, weil sie für Meta-Tags (`description`, `og:description`) weiterhin genutzt wird.

2. `src/routes/karten.warnungen.tsx`
   - `DashboardLayout` nicht mehr mit `subtitle={def.description}` aufrufen; nur den Titel übergeben.

## Prüfung

- Beide Routen (`/warnkarte` und `/karten/warnungen`) zeigen nur noch den Titel, keinen Untertitel.
- Typecheck und Build laufen durch.