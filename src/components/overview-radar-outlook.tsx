import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { getPointRadarFrames } from '@/lib/point-nowcast.functions';
import { pointOutlook, pointOutlookLabel, pointPhase, type PointRadarData, type PointSample } from '@/lib/point-nowcast';

async function samplePoint(data: PointRadarData, location: { lat: number; lon: number }, signal: AbortSignal): Promise<PointSample[]> {
  const b = data.bbox;
  if (location.lat < b.minLat || location.lat > b.maxLat || location.lon < b.minLon || location.lon > b.maxLon) return [];
  const samples: PointSample[] = [];
  const blobs = new Map<string, Blob>();
  const readAlpha = async (url: string, bounds: PointRadarData['bbox']): Promise<number | null> => {
    if (location.lat < bounds.minLat || location.lat > bounds.maxLat || location.lon < bounds.minLon || location.lon > bounds.maxLon) return null;
    let blob = blobs.get(url);
    if (!blob) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error('Bild fehlt');
      blob = await response.blob();
      blobs.set(url, blob);
    }
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Bild nicht lesbar');
      const x = Math.min(bitmap.width - 1, Math.floor((location.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon) * bitmap.width));
      const y = Math.min(bitmap.height - 1, Math.floor((bounds.maxLat - location.lat) / (bounds.maxLat - bounds.minLat) * bitmap.height));
      context.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] ?? null;
    } finally { bitmap.close(); }
  };
  // Sequential decoding bounds mobile memory; bitmaps are released immediately.
  for (const frame of data.frames) {
    if (signal.aborted) throw new Error('Abgebrochen');
    if (frame.t < Date.now() - 5 * 60_000) continue;
    try {
      const alpha = await readAlpha(frame.url, frame.bbox ?? b);
      const phaseAlpha = frame.shifted && alpha !== null && alpha > 0 && data.phaseUrl ? await readAlpha(data.phaseUrl, b) : alpha;
      samples.push({ t: frame.t, phase: phaseAlpha === null ? null : pointPhase(phaseAlpha) });
    } catch {
      if (signal.aborted) throw new Error('Abgebrochen');
      samples.push({ t: frame.t, phase: null });
    }
  }
  return samples;
}

export function OverviewRadarOutlook({ location }: { location: { lat: number; lon: number } | null }) {
  const getFrames = useServerFn(getPointRadarFrames);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const manifest = useQuery({ queryKey: ['overview-radar-manifest'], queryFn: () => getFrames(), enabled: location !== null, staleTime: 60_000, refetchInterval: 60_000 });
  const points = useQuery({
    queryKey: ['overview-radar-point', location?.lat, location?.lon, manifest.data],
    queryFn: async ({ signal }) => {
      if (!location || !manifest.data) return [];
      return samplePoint(manifest.data, location, signal);
    },
    enabled: location !== null && manifest.data != null,
    staleTime: 60_000,
  });
  const outlook = manifest.data && points.data ? pointOutlook(points.data, manifest.data.sourceT, now) : null;
  const loading = manifest.isFetching || points.isFetching;
  return <p role="status" className="mt-1 text-center text-xs font-medium leading-snug" title="Radar-Nowcast · ungefähre Ankunft, keine Garantie für neu entstehende Schauer">{outlook ? pointOutlookLabel(outlook) : loading ? 'Radar-Ausblick lädt …' : pointOutlookLabel(null)}</p>;
}