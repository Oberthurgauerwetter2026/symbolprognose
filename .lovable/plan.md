## Problem

Auf `https://www.oberthurgauerwetter.ch/tagesprognose-post-obt/` ist das Snippet `/embed/region-lokal` eingebettet. Beim Öffnen erscheint kurz eine **Oberthurgau-Karte** (Münsterlingen / Bischofszell etc.), bevor das iframe geladen ist. Diese Karte kommt vom Fallback-`<img>` mit `snapshotId="region"` (siehe `buildSnippet` in `src/routes/embed-info.tsx`, Zeile 36 → `/api/public/snapshot/region.svg`). Da der Embed inhaltlich aber nur die Lokalprognose ohne Karte zeigt, ist dieses Vorschaubild irreführend und soll weg.

## Änderung (nur `src/routes/embed-info.tsx`)

1. `buildSnippet(...)` um einen optionalen Parameter `snapshotId: string | null` erweitern. Wenn `null`, wird das `<a><img></a>`-Fallback komplett weggelassen — der Wrapper bleibt einfach mit hellblauem Hintergrund (`#eaf2fb`) leer, bis das iframe lädt. Das iframe-Fade-In (`opacity 0→1`) bleibt unverändert; der 6-Sekunden-Adblocker-Watchdog wird ebenfalls weggelassen (ohne Snapshot ergibt das Entfernen des iframes keinen Sinn — dann wäre nichts mehr da).
2. Aufruf für „Lokalprognose Amriswil" auf `buildSnippet(url, "/embed/region-lokal", "region-lokal", null, "/karten/region", 480)` umstellen.
3. Alle anderen Snippets (Komplett-Widget, einzelne Karten) bleiben unverändert mit ihrem jeweiligen Karten-Snapshot — dort passt das Vorschaubild.

## Hinweistext

Den Beschreibungstext der Sektion ergänzen: „Ohne Vorschaubild — beim Laden ist nur ein dezenter blauer Hintergrund sichtbar, bis die Prognose erscheint."

## Wichtig für den Nutzer

Damit die Änderung auf der WordPress-Seite sichtbar wird, muss
- das Projekt neu **publiziert** werden (das Snippet zeigt auf `symbolprognose.lovable.app`), und
- der Custom-HTML-Block auf der WordPress-Seite mit dem neuen Snippet ersetzt werden (das alte enthält noch die `<img>`-Zeile, die das Bild zeigt).

## Unverändert

- Route `/embed/region-lokal` selbst.
- Alle anderen Snippets, Snapshots, Karten und Embeds.
