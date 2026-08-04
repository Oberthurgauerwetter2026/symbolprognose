/**
 * Mapping DB-Zeile → serialisierbares DTO für Client und Widgets.
 * Server-only (wird aus Server-Funktionen dynamisch importiert).
 */

import type { WarningWithRegions } from "@/lib/warnings.server";
import type { WarningDTO } from "@/lib/warnings.functions";

export function toDTO(r: WarningWithRegions): WarningDTO {
  const value = (r.params as { value?: unknown } | null)?.value;
  return {
    id: r.id,
    hazard: r.hazard,
    level: r.level,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    title: r.title ?? "",
    description: r.description,
    impact: r.impact,
    peakPhase: r.peak_phase,
    value: value == null ? null : String(value),
    active: r.active,
    source: r.source,
    advisory: r.advisory ?? false,
    regionIds: r.regionIds,
  };
}
