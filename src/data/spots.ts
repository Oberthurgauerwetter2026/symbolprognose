export type Spot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Wenn gesetzt, erscheint der Spot erst ab diesem Zoom-Level. */
  minZoom?: number;
};

export const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4986, lon: 9.4470 },
  { id: "amriswil", name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { id: "bischofszell", name: "Bischofszell", lat: 47.4944, lon: 9.2389 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { id: "romanshorn", name: "Romanshorn", lat: 47.5664, lon: 9.3786 },
  { id: "hauptwil", name: "Hauptwil-Gottshaus", lat: 47.4806, lon: 9.3100, minZoom: 12 },
  { id: "langrickenbach", name: "Langrickenbach", lat: 47.5833, lon: 9.2333, minZoom: 12 },
  { id: "egnach", name: "Egnach", lat: 47.5444, lon: 9.3833, minZoom: 12 },
];
