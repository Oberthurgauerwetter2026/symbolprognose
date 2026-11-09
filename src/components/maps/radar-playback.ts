export const RADAR_STEP_MS = 440;
export const RADAR_TRANSITION_MS = 100;
export const RADAR_NOW_HOLD_MS = 700;
export const RADAR_END_HOLD_MS = 1000;

export type PlaybackPosition = { index: number; elapsed: number };

export function playbackDuration(index: number, count: number, nowIndex: number, speed: number) {
  if (index === count - 1) return RADAR_END_HOLD_MS;
  if (index === nowIndex) return RADAR_NOW_HOLD_MS;
  return RADAR_STEP_MS / Math.max(0.25, speed);
}

export function advancePlayback(position: PlaybackPosition, delta: number, count: number, nowIndex: number, speed: number): PlaybackPosition {
  if (count < 2) return { index: 0, elapsed: 0 };
  let index = position.index;
  let elapsed = position.elapsed + Math.max(0, delta);
  let duration = playbackDuration(index, count, nowIndex, speed);
  while (elapsed >= duration) {
    elapsed -= duration;
    index = (index + 1) % count;
    duration = playbackDuration(index, count, nowIndex, speed);
  }
  return { index, elapsed };
}

export function playbackSample(position: PlaybackPosition, times: number[], nowIndex: number, speed: number) {
  const current = times[position.index] ?? 0;
  const next = times[position.index + 1];
  if (next === undefined) return { frameMs: current, renderMs: current, blend: 0 };
  const duration = playbackDuration(position.index, times.length, nowIndex, speed);
  const transition = Math.min(duration, RADAR_TRANSITION_MS / Math.max(0.25, speed));
  const progress = Math.max(0, Math.min(1, (position.elapsed - (duration - transition)) / transition));
  return { frameMs: current, renderMs: current + (next - current) * progress, blend: progress * progress * (3 - 2 * progress) };
}

export type TimelineFrame = { t: string; source?: string };

/** Modellübergabe und enger Filmstrip-Massstab beginnen am nächsten :00. */
export function nextModelHour(nowMs: number): number {
  const hour = 3_600_000;
  return (Math.floor(nowMs / hour) + 1) * hour;
}

// Zeitleiste: 5-min-Messraster, Nowcast-Brücke, 15-min-Modellbilder nur
// über die Restzeit bis zur nächsten vollen Stunde, danach strikter
// Stundentakt (ICON liefert Stundensummen, Viertelstunden wären Kopien).
export function buildTimelineSteps(frames: TimelineFrame[], nowMs: number): number[] {
  if (frames.length === 0) return [];
  const times = frames.map((f) => Date.parse(f.t));
  const firstMs = times[0];
  const lastMs = times[times.length - 1];
  const STEP5 = 5 * 60_000;
  const TOL = STEP5 / 2;

  // Nächsten Frame zu targetMs per binärer Suche; null wenn ausserhalb Toleranz.
  const pickNearest = (targetMs: number, tolMs: number): number | null => {
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < targetMs) lo = mid + 1;
      else hi = mid;
    }
    const candidates = [lo];
    if (lo > 0) candidates.push(lo - 1);
    let best = -1;
    let bestDiff = Infinity;
    for (const i of candidates) {
      const d = Math.abs(times[i] - targetMs);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return bestDiff <= tolMs ? best : null;
  };

  const out: number[] = [];
  const push = (ms: number) => {
    if (ms < firstMs || ms > lastMs) return;
    if (out.length > 0 && out[out.length - 1] >= ms) return;
    out.push(ms);
  };

  // Messteil: 5-min-Raster, nur Zeitpunkte mit echtem Frame.
  const startMs = Math.ceil(firstMs / STEP5) * STEP5;
  for (let t = startMs; t <= Math.min(lastMs, nowMs); t += STEP5) {
    const i = pickNearest(t, TOL);
    if (i !== null) push(times[i]);
  }

  // Nowcast (verschobenes Radarbild): 5-min-Schritte bis zur nächsten vollen Stunde.
  let nowcastEnd = nowMs;
  for (const f of frames) {
    if (f.source !== "nowcast") continue;
    const ms = Date.parse(f.t);
    if (ms > nowMs) {
      push(ms);
      nowcastEnd = Math.max(nowcastEnd, ms);
    }
  }

  // Prognoseteil: Ohne Nowcast überbrücken 15-min-Modellbilder nur die
  // Restzeit bis zur nächsten vollen Stunde (exklusiv); danach Stundentakt.
  const QUARTER = 15 * 60_000;
  const Q_TOL = 2 * 60_000;
  const HOUR = 60 * 60_000;
  const HOUR_TOL = 4 * 60_000;
  // Auch nach dem Nowcast: Restzeit bis zur nächsten vollen Stunde mit
  // 15-min-Modellbildern füllen statt leer zu springen.
  let lastQuarterHit = nowcastEnd;
  {
    const nextHour = nextModelHour(nowcastEnd);
    const qEnd = Math.min(lastMs, nextHour);
    for (let t = Math.ceil((nowcastEnd + 1) / QUARTER) * QUARTER; t < qEnd; t += QUARTER) {
      const i = pickNearest(t, Q_TOL);
      if (i !== null && times[i] > nowcastEnd && frames[i].source !== "nowcast") {
        push(times[i]);
        lastQuarterHit = times[i];
      }
    }
  }
  const startFc = Math.ceil((lastQuarterHit + 1) / HOUR) * HOUR;
  for (let h = startFc; h <= lastMs; h += HOUR) {
    const i = pickNearest(h, HOUR_TOL);
    if (i !== null && times[i] > nowMs) push(times[i]);
  }

  if (out.length === 0) out.push(firstMs);
  return out;
}