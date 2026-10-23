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