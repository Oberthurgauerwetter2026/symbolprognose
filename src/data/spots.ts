export type Spot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /**
   * MeteoSwiss `ogd-local-forecasting` point_id (PLZ-Punkt). Wird von
   * `scripts/ingest_mch_local_forecast.py` benutzt, um pro Spot eine
   * Punktprognose aus dem STAC zu ziehen.
   */
  mchPointId: number;
  /** Wenn gesetzt, erscheint der Spot erst ab diesem Zoom-Level. */
  minZoom?: number;
  /** Optionaler Anzeige-Offset für den Marker (Grad). Beeinflusst NICHT den Forecast-Request. */
  markerLatOffset?: number;
  markerLonOffset?: number;
};

export const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4929, lon: 9.4610, mchPointId: 932600 },
  { id: "amriswil", name: "Amriswil", lat: 47.5428, lon: 9.2871, mchPointId: 858000 },
  { id: "bischofszell", name: "Bischofszell", lat: 47.4957, lon: 9.2158, mchPointId: 922301 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6254, lon: 9.2356, mchPointId: 859601 },
  { id: "romanshorn", name: "Romanshorn", lat: 47.5636, lon: 9.3569, mchPointId: 859000, markerLatOffset: 0.012, markerLonOffset: 0.022 },
  { id: "hauptwil", name: "Hauptwil-Gottshaus", lat: 47.4896, lon: 9.2801, mchPointId: 922500, minZoom: 12 },
  { id: "langrickenbach", name: "Langrickenbach", lat: 47.5946, lon: 9.2409, mchPointId: 858508, minZoom: 12 },
  { id: "egnach", name: "Egnach", lat: 47.5288, lon: 9.3652, mchPointId: 931500, minZoom: 12 },
];
