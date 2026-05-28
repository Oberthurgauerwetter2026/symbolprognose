/**
 * JS-freier Fallback für /embed/region-lokal ("Karte + Lokalprognose Amriswil").
 * Zeigt das jüngste echte Radarbild als statische Karte plus die volle
 * Lokalprognose (aktuell + Zeitverlauf + 7-Tage) für Amriswil.
 * Reine Präsentation, keine Hooks.
 */

import { LokalNoscript, type LokalNoscriptData } from "@/components/embeds/lokal-noscript";

export interface RegionLokalNoscriptData {
  mapImageUrl?: string;
  mapImageTime?: string;
  forecast: LokalNoscriptData;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function RegionLokalNoscript({ data }: { data: RegionLokalNoscriptData }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 font-sans text-sm text-foreground">
      {data.mapImageUrl ? (
        <figure className="rounded-lg border border-border bg-card p-2">
          <img
            src={data.mapImageUrl}
            alt={`Wetterkarte Region${data.mapImageTime ? ` um ${fmtTime(data.mapImageTime)}` : ""}`}
            width={800}
            height={480}
            className="block h-auto w-full rounded"
          />
          <figcaption className="mt-1 text-xs text-muted-foreground">
            Letzte Messung
            {data.mapImageTime ? ` · ${fmtTime(data.mapImageTime)}` : ""}
            {" · "}MeteoSchweiz CPC
          </figcaption>
        </figure>
      ) : null}

      <LokalNoscript data={data.forecast} />
    </div>
  );
}
