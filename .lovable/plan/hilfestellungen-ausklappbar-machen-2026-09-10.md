# Hilfestellungen ausklappbar machen

## Ziel
Die Hilfestellungen im Push-Opt-In-Bereich der Warnkarte sollen Platz sparen, indem lange Anleitungen zunächst eingeklappt sind und der Nutzer sie bei Bedarf aufklappt.

## Ausgangslage
In `src/components/warnings/push-opt-in.tsx` gibt es bereits einige ausklappbare Bereiche:
- „Wie funktioniert das?“ (`howOpen`)
- „Wo funktionieren Warn-Meldungen?“ (`whereOpen`)
- Eingebettete Vorschau-Hinweis (`hintOpen`)

Daneben werden aber mehrere längere Anleitungen als feste, aufgeklappte Panels dargestellt, z. B.:
- iOS: „Erst zum Home-Bildschirm hinzufügen“ mit fünf Schritten
- iOS-In-App-Browser: Hinweis + Buttons
- Nicht-unterstützter Browser: Erklärung + Übersicht
- Eingebettete Ansicht: Erklärung + Buttons + iOS-Schritte + Übersicht

Das frisst vor allem auf kleinen Bildschirmen viel Platz.

## Was geändert wird
1. Lange statische Hilfepanels werden auf eine einzeilige Zusammenfassung mit `ChevronDown` reduziert, die beim Antippen aufklappt.
2. In eingeklapptem Zustand ist die wichtigste Handlungsaufforderung sichtbar, z. B.:
   - iOS: „Erst als Web-App speichern (iPhone)“
   - Android/Desktop: „Direkt aktivieren möglich“ oder „Browser unterstützt keine Push-Benachrichtigungen“
   - Eingebettet: „Im eigenen Tab öffnen, um Push zu aktivieren“
3. Details (Schritt-für-Schritt-Anleitung, Geräteliste, Adresse-kopieren-Button) erscheinen erst nach Aufklappen.
4. Bereits aufklappbare Bereiche („Wie funktioniert das?“, „Wo funktionieren Warn-Meldungen?“) bleiben erhalten.
5. Die aktiven Steuerelemente (Gemeinden wählen, Aktivieren/Ausschalten) bleiben jederzeit unmittelbar erreichbar.

## Technisch
- Datei: `src/components/warnings/push-opt-in.tsx`
- Neue/angepasste Hilfskomponente(n) für ein einheitliches „Summary + Details“-Panel mit Chevron.
- Keine Änderungen an State, Server-Funktionen, Push-Logik oder Datenbank.

## Nicht im Scope
- Keine Änderung der Textinhalte (nur Darstellung).
- Keine Änderung der Push-Berechtigungslogik.
