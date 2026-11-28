import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadSeries, loadSums } from "./station-series.server";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Messverlauf einer Station: Rohwerte am Tag, Stundenwerte im Monat, Tageswerte im Jahr. */
export const getStationSeries = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ stationId: z.string().min(1).max(64), range: z.enum(["day", "month", "year", "custom"]), anchor: day.optional(), from: day.optional(), to: day.optional() }).parse(input))
  .handler(async ({ data }) => loadSeries(data));

/** Summen, Mittel und Extreme aller Stationen über Zürcher Kalendertage. */
export const getStationSums = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ from: day, to: day }).parse(input))
  .handler(async ({ data }) => loadSums(data));
