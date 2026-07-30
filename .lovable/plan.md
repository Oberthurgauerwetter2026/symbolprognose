## Ziel

Wer Benachrichtigungen abonnieren will, öffnet einen neuen Tab. Dieser Tab soll ausschliesslich die Warnkarte samt Abo-Bereich zeigen – ohne Sidebar, ohne Karten-Tabs, ohne weitere Produkte.

## Ist-Zustand

Beide „In eigenem Tab öffnen“-Links zeigen auf `/karten/warnungen`. Diese Seite rendert `DashboardLayout` (Sidebar/Navigation zu allen Produkten) und `MapTabs` (Radar, Wind, Satellit, …).

## Umsetzung

1. **Neue Route `src/routes/warnkarte.tsx`**
   - Eigenständige, schlanke Seite (kein `DashboardLayout`, keine `MapTabs`).
   - Inhalt: kompakter Kopf („Wetterwarnungen Oberthurgau“ + kurze Zeile), `<WarnMap />` mit dem bestehenden Abo-Block (`PushOptIn` ist bereits Teil der Karte), dezente Fusszeile mit Link zur Hauptseite.
   - Eigene `head()`-Metadaten (Titel, Description, og:*), `ssr: false` wie bei den anderen Kartenrouten.
   - Volle Breite bis ca. `max-w-3xl`, damit die Seite auf Mobile gut funktioniert.

2. **Links umstellen auf die neue Seite**
   - `src/components/warnings/push-opt-in.tsx`: `getAppUrl("/karten/warnungen")` → `getAppUrl("/warnkarte")`.
   - `src/routes/embed.warnungen.tsx`: Button-Ziel → `${SITE_URL}/warnkarte`.

3. **`/karten/warnungen` bleibt unverändert** als reguläre Seite innerhalb der Navigation.

## Technische Details

- Push funktioniert dort unverändert, da die Seite Top-Level (nicht im Iframe) geöffnet wird und derselbe Origin wie der Service Worker `/push-sw.js` gilt.
- Keine Backend- oder Datenänderungen nötig.
