import { createServerFn } from '@tanstack/react-start';
import { getRadarRegionMax } from './openmeteo-cache.server';
import { fetchR2, r2ObjectUrlCandidates } from './r2-url.server';
import type { PointRadarData } from './point-nowcast';
import { isUsableMotion, nowcastSteps } from './radar-nowcast';

/** Small manifest only: no map grids, forecasts, model inference or region maxima as point data. */
export const getPointRadarFrames = createServerFn({ method: 'GET' }).handler(async (): Promise<PointRadarData | null> => {
  const regionData = await getRadarRegionMax();
  const region = regionData && Date.now() - Date.parse(regionData.t) <= 20 * 60_000 ? regionData : null;
  const candidates = [
    ...r2ObjectUrlCandidates(process.env['RADAR_MANIFEST_URL'], 'radar/frames.json'),
    ...r2ObjectUrlCandidates(process.env['RADAR_R2_PUBLIC_URL'], 'radar/frames.json'),
    ...r2ObjectUrlCandidates(process.env['R2_PUBLIC_URL'], 'radar/frames.json'),
  ];
  for (const url of new Set(candidates)) {
    try {
      const response = await fetchR2(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) continue;
      const manifest = await response.json() as { bbox: PointRadarData['bbox']; frames: { t: string; precipUrl?: string }[] };
      const bbox = manifest.bbox;
      if (!bbox || ![bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon].every(Number.isFinite) || !Array.isArray(manifest.frames)) continue;
      const latest = manifest.frames.filter(f => f.precipUrl && Number.isFinite(Date.parse(f.t))).sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0];
      if (!latest) return null;
      const matchedRegion = region && Math.abs(Date.parse(latest.t) - Date.parse(region.t)) <= 15 * 60_000 ? region : null;
      const sourceT = Date.parse(latest.t);
      if (Date.now() - sourceT > 20 * 60_000) return null;
      const proxy = (raw: string): string | null => {
        const path = new URL(raw).pathname.match(/\/(radar\/[A-Za-z0-9._\-/]+\.png)$/)?.[1];
        return path ? `/api/public/radar/proxy?path=${encodeURIComponent(path)}` : null;
      };
      const frames: PointRadarData['frames'] = [];
      if (latest.precipUrl) {
        const measuredUrl = proxy(latest.precipUrl);
        if (measuredUrl) frames.push({ t: sourceT, url: measuredUrl });
      }
      for (const frame of matchedRegion?.nowcastFrames ?? []) {
        const t = Date.parse(frame.t);
        if (frame.advected !== true || Math.abs(Date.parse(frame.sourceT) - sourceT) > 15 * 60_000 || t < Date.now() - 5 * 60_000 || t > Date.now() + 65 * 60_000) continue;
        const imageUrl = proxy(frame.precipUrl);
        if (imageUrl) frames.push({ t, url: imageUrl });
      }
      const phaseField = matchedRegion?.phaseField;
      const phaseUrl = phaseField && Math.abs(Date.parse(phaseField.t) - sourceT) <= 15 * 60_000 ? proxy(phaseField.url) : null;
      // Match the map's pure-advection fallback only when no pre-advected
      // generation exists. Never substitute a missing pre-advected frame.
      const hasAdvected = matchedRegion?.nowcastFrames?.some(f => f.advected === true);
      const measuredUrl = latest.precipUrl ? proxy(latest.precipUrl) : null;
      if (!hasAdvected && measuredUrl && phaseUrl && matchedRegion && isUsableMotion(matchedRegion.motion)) {
        for (const step of nowcastSteps(sourceT, Date.now(), matchedRegion.motion, bbox)) {
          if (step.tMs > Date.now() + 65 * 60_000) break;
          frames.push({ t: step.tMs, url: measuredUrl, bbox: step.bbox, shifted: true });
        }
      }
      return { sourceT, bbox, frames, ...(phaseUrl ? { phaseUrl } : {}), ...(measuredUrl && !hasAdvected && frames.length === 1 ? { measurementUrl: measuredUrl } : {}) };
    } catch { /* Unavailable is never dry. Try the next configured image store. */ }
  }
  return null;
});