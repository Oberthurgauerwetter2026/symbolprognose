## Problem

Der Tooltip auf den Regen-Säulen der 5-Tage-Kacheln zeigt nichts an. Ursache:

1. Es wird das native `title`-Attribut auf einem `<div>` benutzt, das **innerhalb eines `<button>`** (Tageskachel, Zeile 599) sitzt. Browser zeigen `title` zwar grundsätzlich auch dort, aber:
   - Auf Touch-Geräten (iPad/iPhone) erscheint `title` **nie** — und der User testet im Vorschau-Iframe.
   - Beim Hover über eine Säule wird zuerst der Button-Klick-Hover registriert; das native Tooltip kommt erst nach ~1.5 s und oft gar nicht, weil der Mausweg minimal ausreicht, um es zu unterdrücken.
2. Außerdem ist es derselbe `title` für die ganze Kachelspalte (8 Säulen mit jeweils eigenem title → der Cursor bekommt nur den der getroffenen Säule, aber Wechsel zwischen Säulen reset den Hover-Timer).

## Fix

`DayRainSparkline` in `src/components/weather-widget.tsx` (Zeilen 609–664) auf **Radix `Tooltip`** umstellen — derselbe, der bereits in `src/components/ui/tooltip.tsx` vorhanden ist. Funktioniert auf Touch (long-press) und sofort auf Desktop.

Konkrete Änderungen, rein Präsentation:

1. Imports ergänzen (oben in `weather-widget.tsx`):
   ```ts
   import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
   ```
2. `DayRainSparkline` wrappen:
   ```tsx
   <TooltipProvider delayDuration={150}>
     <div className="flex h-8 w-full items-end gap-px">
       {buckets.map((b, k) => (
         <Tooltip key={k}>
           <TooltipTrigger asChild>
             <span
               className="flex-1 h-full flex flex-col justify-end bg-zinc-300/40 rounded-sm overflow-hidden cursor-help"
               onClick={(e) => e.stopPropagation()}
             >
               {/* probExtra + mm wie bisher */}
             </span>
           </TooltipTrigger>
           <TooltipContent side="top" className="text-xs">
             <div className="font-semibold">{from}–{to} Uhr</div>
             <div>{b.mm.toFixed(1)} mm · {b.prob}% Regenrisiko</div>
           </TooltipContent>
         </Tooltip>
       ))}
     </div>
   </TooltipProvider>
   ```
   - `asChild` + `<span>` vermeidet ungültiges `<button>`-in-`<button>` (Trigger rendert sonst ein `<button>` innerhalb der Tageskachel).
   - `onClick stopPropagation` verhindert, dass das Antippen einer Säule die Tageskachel selektiert — Säulen sind reine Info, nicht Auswahl.
   - `delayDuration={150}` ist schnell genug zum sofortigen Anzeigen.
3. Analog für die große Stunden-Detailansicht (Zeile 1116, ebenfalls `title` auf div in interaktivem Kontext) — gleiche `Tooltip`-Behandlung anwenden, damit beide Sparklines konsistent sind.

Keine Backend-, Daten- oder Style-Token-Änderung.

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil`:
- Hover über eine Säule auf Desktop → Tooltip „12–15 Uhr · 0.0 mm · 24% Regenrisiko" erscheint innerhalb von ~150 ms.
- Tippen auf einer Säule auf Touch → Tooltip erscheint, Tageskachel-Auswahl ändert sich **nicht**.
- Funktioniert auch in der Stunden-Detailansicht.
