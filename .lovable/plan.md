## Problem

Im Stunden-Panel werden Regen-Säulen nur gezeichnet, wenn `mm > 0`. Bei reiner Regen­wahrscheinlichkeit (z. B. 24 %, aber 0 mm) bleibt die Achse leer — obwohl die Legende „mm (sicher) · % (Risiko)" beides verspricht. Die Tages-Sparkline (`DayRainSparkline`) macht es bereits richtig: voller Balken für mm, transparenter Aufsatz für %.

## Fix

In `src/components/weather-widget.tsx`, Stunden-Säulen-Block (ca. Z. 1135–1158), dieselbe Zwei-Schicht-Logik wie in `DayRainSparkline` anwenden:

- `mmHeight = (mm / 5) * 100` (gedeckelt 100, kleine `minHeight` wenn mm>0).
- `probTop = max(mmHeight, prob)` wenn `prob ≥ 5`.
- `probExtra = probTop − mmHeight` → wird oben mit `opacity: 0.25` gezeichnet.
- `mm`-Balken voll deckend in `var(--wx-rain)`.

Ergebnis: Bei 0 mm + 24 % erscheint ein schwacher, transparenter Balken auf 24 % Höhe; bei z. B. 1 mm + 80 % ein voller Balken bis 20 % plus transparenter Aufsatz bis 80 %.

Tooltip-Inhalt und Beschriftung darunter bleiben unverändert.

### Technisch

```tsx
{perHour.map(({ mm, prob }, k) => {
  const mmHeight = mm > 0 ? Math.min(100, (mm / 5) * 100) : 0;
  const probVisible = prob >= 5;
  const probTop = probVisible ? Math.max(mmHeight, Math.min(100, prob)) : mmHeight;
  const probExtra = Math.max(0, probTop - mmHeight);
  const widthCls = cadence === "1h" ? "w-3 @[640px]:w-3.5" : "w-2 @[640px]:w-2.5";
  return (
    <Tooltip key={k}>
      <TooltipTrigger asChild>
        <span className={`${widthCls} h-full flex flex-col justify-end rounded-sm overflow-hidden`}>
          {probExtra > 0 && (
            <div className="w-full bg-[var(--wx-rain)]" style={{ height: `${probExtra}%`, opacity: 0.25 }} />
          )}
          {mm > 0 && (
            <div className="w-full bg-[var(--wx-rain)] rounded-sm" style={{ height: `${mmHeight}%`, minHeight: 2 }} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent ...>...</TooltipContent>
    </Tooltip>
  );
})}
```

Container der Balken (`.flex items-end justify-around`) bleibt; die Spans müssen jedoch `h-full` haben statt `height: pct%`, damit die innere Zwei-Schicht-Aufteilung relativ zum 72 px-Plot funktioniert.

Wird das so auch bei Wetterdiensten gemahct?