/**
 * Kleiner farbiger Warn-Chip (Gefahren-Icon + optionaler Text) für
 * Lokal- und Symbolprognose. Farbe = Warnstufe.
 */

import { getHazard, LEVELS, formatRange, type HazardId, type WarnLevel } from "@/lib/warnings-config";
import type { WarningDTO } from "@/lib/warnings.functions";

export function WarningBadge({
  warning,
  size = "md",
  withLabel = true,
}: {
  warning: WarningDTO;
  size?: "sm" | "md";
  withLabel?: boolean;
}) {
  const hazard = getHazard(warning.hazard as HazardId);
  const lvl = LEVELS[(Math.max(1, Math.min(3, warning.level)) as WarnLevel)];
  const Icon = hazard.icon;
  const iconPx = size === "sm" ? 14 : 18;
  const range = formatRange(warning.validFrom, warning.validTo);
  return (
    <span
      title={`${warning.title || hazard.title} · ${range}`}
      className={
        "inline-flex items-center gap-1.5 rounded-full font-semibold " +
        (size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")
      }
      style={{ background: lvl.color, color: lvl.textOnColor }}
    >
      <Icon width={iconPx} height={iconPx} strokeWidth={2.2} aria-hidden />
      {withLabel && <span>{warning.title || `${hazard.title} (Stufe ${warning.level})`}</span>}
    </span>
  );
}
