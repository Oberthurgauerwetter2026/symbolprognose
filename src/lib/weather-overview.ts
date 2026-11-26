import type { StationExtreme } from './station-extremes';

export function distanceKm(lat: number, lon: number, station: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const a = Math.sin((station.lat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(station.lat * rad) * Math.sin((station.lon - lon) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/** Never substitute old or missing temperatures for a live measurement. */
export function nearestLiveStation(stations: StationExtreme[], lat: number, lon: number) {
  return stations.filter(s => typeof s.current === 'number' && Number.isFinite(s.current))
    .map(station => ({ station, distance: distanceKm(lat, lon, station) }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}