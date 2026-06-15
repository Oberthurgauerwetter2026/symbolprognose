Add a thermometer icon before the minimum temperature value in the day tiles of the weather widget.

## Details
- **Location:** `src/components/weather-widget.tsx`, around the min/max temperature display in the day tiles (lines 570–575)
- **Icon:** `Thermometer` from `lucide-react`
- **Style:** `w-3.5 h-3.5 text-zinc-600` with `aria-hidden`, placed before the min temperature number in an `inline-flex items-center gap-1` wrapper
- **No changes** to font weight, colors, layout spacing, or other elements
- **Out of scope:** max temperature, detail panel, data logic