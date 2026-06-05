export type Spot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Wenn gesetzt, erscheint der Spot erst ab diesem Zoom-Level. */
  minZoom?: number;
  /** Optionaler Anzeige-Offset für den Marker (Grad). Beeinflusst NICHT den Forecast-Request. */
  markerLatOffset?: number;
  markerLonOffset?: number;
};

export const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4929, lon: 9.4610 },
  { id: "amriswil", name: "Amriswil", lat: 47.5428, lon: 9.2871 },
  { id: "bischofszell", name: "Bischofszell", lat: 47.4957, lon: 9.2158 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6254, lon: 9.2356 },
  { id: "romanshorn", name: "Romanshorn", lat: 47.5636, lon: 9.3569, markerLonOffset: 0.012 },
  { id: "hauptwil", name: "Hauptwil-Gottshaus", lat: 47.4896, lon: 9.2801, minZoom: 12 },
  { id: "langrickenbach", name: "Langrickenbach", lat: 47.5946, lon: 9.2409, minZoom: 12 },
  { id: "egnach", name: "Egnach", lat: 47.5288, lon: 9.3652, minZoom: 12 },
];
