Switch the hourly forecast strip in `src/components/weather-widget.tsx` to a single 3-h cadence and remove the 1-h section.

## Changes

1. **`allHourly` builder (lines ~187–216):** drop the 12-h 1-h window. Iterate all hours from "now" forward, keep only those where `hr % 3 === 0` (the natural 3-h block boundary, e.g. 00, 03, 06, 09, 12, 15, 18, 21). Emit only `cadence: "3h"` entries. The first slot is the most recent 3-h block that contains the current time.

2. **Legend (lines 739–748):** remove the "1-h-Takt" entry and the "(ab +12 h)" suffix on the 3-h entry, leaving a single "3-h-Takt" label.

3. **Cadence-break marker (lines 874–878):** remove the "ab +12 h · 3-h-Takt" overlay since there is no longer a transition.

4. **Cadence-dependent branches** in slot, precip-bar, sunshine-bar, and snow-bar rows (lines ~838–1120): leave the existing `cadence === "1h"` ternaries in place; they simply always take the `"3h"` branch now. No structural change needed.

## Out of scope
- Day tiles, detail panel header, data fetching, chart axes, colors, fonts.