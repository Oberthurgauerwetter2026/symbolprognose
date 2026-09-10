# Hilfestellungen auch im Vorschaufenster zeigen

## Was du siehst
Im eingebetteten Vorschaufenster (und in Widgets) erscheint nur der kurze Hinweis „Push im Vorschaufenster nicht möglich“ mit dem Knopf „In eigenem Tab öffnen“. Die Anleitungen für iPhone, Android, Computer und App-Browser sind dort ausgeblendet — deshalb wirkt es, als gäbe es keine Hilfestellung.

## Was geändert wird
1. Im Vorschau-/Widget-Fall zusätzlich die aufklappbare Übersicht „Wo funktionieren Warn-Meldungen?“ anzeigen, mit den Schritten je Gerät und Browser.
2. Wird die Seite auf einem iPhone im Vorschaufenster geöffnet, zusätzlich die iPhone-Kurzanleitung („Teilen → Zum Home-Bildschirm → Web-App“) einblenden.
3. Kurzer Einstiegssatz über dem Aufklapper, damit die Hilfe auffindbar ist: „Anleitung für dein Gerät“.

Sonst bleibt alles unverändert: Knopf „In eigenem Tab öffnen“, Gemeindeauswahl, Anleitungen außerhalb des Vorschaufensters.

## Technisch
- `src/components/warnings/push-opt-in.tsx`: im `framed`-Zweig (ab Zeile 423) `<WhereList />` und bei `env?.isIos` die bestehende iOS-Schrittliste rendern; die Schritte in eine kleine Hilfskomponente auslagern, damit iOS-Zweig und `framed`-Zweig denselben Text nutzen. Keine Logik-, State- oder Backend-Änderungen.
