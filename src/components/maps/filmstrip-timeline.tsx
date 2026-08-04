import { useEffect, useMemo, useRef, useState } from "react";

import { haptic, hapticsAvailable } from "@/lib/haptics";


/**
 * Wiederverwendbarer Filmstrip aus dem Niederschlagsradar.
 * Scrollender Streifen mit fixer Mittellinie, Bubble oben,
 * Stunden-/10-min-Ticks, Tageswechsel-Marker sowie optionalem
 * Messungs-/Prognose-Band (nowMs-Split).
 */

export type FilmstripFrame = { ms: number };

export type FilmstripBandMode = "measurement-forecast" | "measurement-only" | "forecast-only";

const DEFAULT_MEASUREMENT_COLOR = "#9ca3af";
const DEFAULT_FORECAST_COLOR = "#2561a1";

export function FilmstripTimeline({
  frames,
  idx,
  onChange,
  onScrubMs,
  isMobile,
  playing = false,
  visualMs,
  color,
  bandMode,
  bandColors,
  formatBubble,
  ariaLabel,
}: {
  frames: FilmstripFrame[];
  idx: number;
  onChange: (i: number) => void;
  onScrubMs?: (ms: number | null) => void;
  isMobile: boolean;
  playing?: boolean;
  visualMs?: number | null;
  color: string;
  bandMode: FilmstripBandMode;
  bandColors?: { measurement?: string; forecast?: string };
  formatBubble: (d: Date) => string;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerW(containerRef.current.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setContainerW(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PX_PER_HOUR = isMobile ? 56 : 72;
  const times = useMemo(() => frames.map((f) => f.ms), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const nowMs = Date.now();
  const totalWidth = ((tMax - tMin) / 3_600_000) * PX_PER_HOUR;

  const hours = useMemo(() => {
    const start = Math.ceil(tMin / 3_600_000) * 3_600_000;
    const out: { ms: number; left: number; hour: number }[] = [];
    for (let t = start; t <= tMax; t += 3_600_000) {
      out.push({
        ms: t,
        left: ((t - tMin) / 3_600_000) * PX_PER_HOUR,
        hour: new Date(t).getHours(),
      });
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const ticks10 = useMemo(() => {
    const start = Math.ceil(tMin / 600_000) * 600_000;
    const out: number[] = [];
    for (let t = start; t <= tMax; t += 600_000) {
      out.push(((t - tMin) / 3_600_000) * PX_PER_HOUR);
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const dayBreaks = hours.filter((h) => h.hour === 0);

  const [dragMs, setDragMs] = useState<number | null>(null);
  const dragging = dragMs !== null;
  const lastSentIdxRef = useRef<number>(idx);
  const lastHapticIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!dragging) {
      lastSentIdxRef.current = idx;
      lastHapticIdxRef.current = idx;
    }
  }, [dragging, idx]);

  const nearestIndexForMs = (target: number): number => {
    let best = 0;
    let bestDt = Infinity;
    for (let i = 0; i < times.length; i++) {
      const dt = Math.abs(times[i] - target);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    return best;
  };
  const dragIdx = dragMs !== null ? nearestIndexForMs(dragMs) : idx;
  const displayIdx = dragging ? dragIdx : idx;
  const frameMs = times[displayIdx] ?? tMin;
  // Bubble und Strip rasten immer auf echte Frame-Zeiten ein (5-min-Messung,
  // Prognose-Kadenz). Die kontinuierliche Zeit dient nur dem Karten-Morphing.
  const motionMs = dragging
    ? frameMs
    : visualMs != null
      ? (times[nearestIndexForMs(visualMs)] ?? frameMs)
      : frameMs;
  const translateX = containerW / 2 - ((motionMs - tMin) / 3_600_000) * PX_PER_HOUR;
  const nowLeft = Math.max(0, Math.min(totalWidth, ((nowMs - tMin) / 3_600_000) * PX_PER_HOUR));
  const bubbleLabel = formatBubble(new Date(motionMs));

  const measurementColor = bandColors?.measurement ?? DEFAULT_MEASUREMENT_COLOR;
  const forecastColor = bandColors?.forecast ?? DEFAULT_FORECAST_COLOR;
  const showMeasurementBand = bandMode !== "forecast-only";
  const showForecastBand = bandMode !== "measurement-only";
  // Messungs-Band-Breite: split am nowMs (Radar) oder Vollbreite (Satellit).
  const measurementWidth = bandMode === "measurement-forecast" ? nowLeft : totalWidth;
  // Prognose-Band-Startposition: ab nowMs (Radar) oder ab 0 (Wind).
  const forecastLeft = bandMode === "measurement-forecast" ? nowLeft : 0;
  const forecastWidth =
    bandMode === "measurement-forecast" ? Math.max(0, totalWidth - nowLeft) : totalWidth;

  const dragStartRef = useRef<{ x: number; ms: number } | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  // Kinetisches Scrollen: geglättete Geschwindigkeit (ms Zeitachse pro ms Realzeit)
  const velRef = useRef(0);
  const lastMoveRef = useRef<{ x: number; t: number } | null>(null);
  const momentumRafRef = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  };

  useEffect(() => stopMomentum, []);
  useEffect(() => {
    if (playing) stopMomentum();
  }, [playing]);

  const isCoarsePointer = () =>
    typeof window !== "undefined" &&
    hapticsAvailable() &&
    window.matchMedia("(pointer: coarse)").matches;

  const hapticFor = (ms: number) => {
    if (!isCoarsePointer()) return;
    const d = new Date(ms);
    const isDayBreak = d.getHours() === 0 && d.getMinutes() === 0;
    const isForecast =
      bandMode === "measurement-forecast" ? ms > nowMs : bandMode === "forecast-only";
    haptic(isDayBreak ? [10, 30, 15] : isForecast ? 8 : 4);
  };

  const onDown = (e: React.PointerEvent) => {
    stopMomentum();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, ms: motionMs };
    velRef.current = 0;
    lastMoveRef.current = { x: e.clientX, t: performance.now() };
    setDragMs(motionMs);
    if (isCoarsePointer()) haptic(6);
  };

  const snapAndEmit = (target: number) => {
    const best = nearestIndexForMs(target);
    if (best !== lastSentIdxRef.current) {
      lastSentIdxRef.current = best;
      onChange(best);
      if (best !== lastHapticIdxRef.current) {
        lastHapticIdxRef.current = best;
        hapticFor(times[best] ?? target);
      }
    }
    return best;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const now = performance.now();
    const last = lastMoveRef.current;
    if (last) {
      const dt = now - last.t;
      if (dt > 4) {
        // px/ms -> Zeitachse ms pro Realzeit-ms (Ziehen nach links = vorwärts)
        const v = ((-(e.clientX - last.x) / PX_PER_HOUR) * 3_600_000) / dt;
        velRef.current = velRef.current * 0.8 + v * 0.2;
        lastMoveRef.current = { x: e.clientX, t: now };
      }
    } else {
      lastMoveRef.current = { x: e.clientX, t: now };
    }
    const dx = e.clientX - dragStartRef.current.x;
    const dMs = (-dx / PX_PER_HOUR) * 3_600_000;
    const target = Math.max(tMin, Math.min(tMax, dragStartRef.current.ms + dMs));
    pendingTargetRef.current = target;
    if (rafPendingRef.current !== null) return;
    rafPendingRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = null;
      const t = pendingTargetRef.current;
      if (t === null) return;
      snapAndEmit(t);
      setDragMs(t);
      onScrubMs?.(t);
    });
  };

  const startMomentum = (fromMs: number) => {
    let ms = fromMs;
    let v = velRef.current;
    let prev = performance.now();
    const FRICTION = 0.95;
    // Schwelle: unter ~1 Sekunde Zeitachse pro Sekunde Realzeit ist der Schwung aus.
    const MIN_V = 1.5;

    const finish = () => {
      momentumRafRef.current = null;
      snapAndEmit(ms);
      setDragMs(null);
      onScrubMs?.(null);
    };

    const step = () => {
      const now = performance.now();
      const dt = Math.min(48, now - prev);
      prev = now;
      ms += v * dt;
      v *= Math.pow(FRICTION, dt / 16.67);
      if (ms <= tMin) {
        ms = tMin;
        finish();
        return;
      }
      if (ms >= tMax) {
        ms = tMax;
        finish();
        return;
      }
      snapAndEmit(ms);
      setDragMs(ms);
      onScrubMs?.(ms);
      if (Math.abs(v) < MIN_V) {
        finish();
        return;
      }
      momentumRafRef.current = requestAnimationFrame(step);
    };
    momentumRafRef.current = requestAnimationFrame(step);
  };

  const onUp = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    lastMoveRef.current = null;
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
      rafPendingRef.current = null;
    }
    const lastTarget = pendingTargetRef.current;
    pendingTargetRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const from = lastTarget ?? dragMs ?? start?.ms ?? motionMs;
    if (Math.abs(velRef.current) > 3 && from > tMin && from < tMax) {
      startMomentum(from);
      return;
    }
    velRef.current = 0;
    setDragMs(null);
    onScrubMs?.(null);
  };


  return (
    <div className="select-none">
      {/* Bubble über fixer Mittellinie */}
      <div className="relative h-7">
        <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
            style={{ background: color }}
          >
            {bubbleLabel}
          </span>
          <span
            className="h-0 w-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${color}`,
            }}
          />
        </div>
      </div>

      {/* Filmstreifen */}
      <div
        ref={containerRef}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={frames.length - 1}
        aria-valuenow={idx}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const next = Math.max(0, idx - 1);
            if (next !== lastHapticIdxRef.current) {
              lastHapticIdxRef.current = next;
              hapticFor(times[next] ?? tMin);
            }
            onChange(next);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            const next = Math.min(frames.length - 1, idx + 1);
            if (next !== lastHapticIdxRef.current) {
              lastHapticIdxRef.current = next;
              hapticFor(times[next] ?? tMin);
            }
            onChange(next);
          }
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-12 cursor-grab touch-none overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-b from-neutral-50 to-neutral-100 shadow-inner outline-none active:cursor-grabbing focus-visible:ring-2"
        style={{ ["--tw-ring-color" as never]: color }}
      >
        {/* Fixe Mittel-Linie */}
        <span className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px -translate-x-1/2 bg-neutral-900/85" />
        <span
          className="pointer-events-none absolute left-1/2 top-0 z-30 h-2 w-2 -translate-x-1/2 rotate-45"
          style={{ background: color }}
        />

        {/* Scrollender Strip */}
        <div
          className="absolute inset-y-0 left-0 will-change-transform"
          style={{
            width: `${totalWidth}px`,
            transform: `translate3d(${translateX}px,0,0)`,
            transition: dragging || playing ? "none" : "transform 220ms cubic-bezier(.22,1,.36,1)",
          }}
        >
          {showMeasurementBand && (
            <div
              className="absolute top-6 h-4 rounded-sm"
              style={{
                left: 0,
                width: measurementWidth,
                background: measurementColor,
                opacity: 0.6,
              }}
            />
          )}
          {showForecastBand && (
            <div
              className="absolute top-6 h-4 rounded-sm"
              style={{
                left: forecastLeft,
                width: forecastWidth,
                background: forecastColor,
                opacity: 0.68,
              }}
            />
          )}

          {/* 10-min-Ticks */}
          {ticks10.map((l, i) => (
            <span
              key={`m10-${i}`}
              className="absolute top-7 h-2 w-px bg-white/45"
              style={{ left: l }}
            />
          ))}

          {/* Stunden-Ticks + Labels */}
          {hours.map((h) => (
            <div key={`h-${h.ms}`} className="absolute top-0 h-full" style={{ left: h.left }}>
              <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-neutral-600">
                {String(h.hour).padStart(2, "0")}:00
              </span>
              <span className="absolute top-6 h-4 w-px bg-neutral-900/40" />
            </div>
          ))}

          {/* Tageswechsel */}
          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="absolute top-6 h-4 w-[2px] bg-neutral-900/70"
              style={{ left: b.left }}
            />
          ))}

          {/* "Jetzt"-Marker im Strip (nur wenn nowMs innerhalb liegt) */}
          {bandMode === "measurement-forecast" && nowLeft > 0 && nowLeft < totalWidth && (
            <span className="absolute top-5 h-6 w-[2px] bg-neutral-950" style={{ left: nowLeft }} />
          )}
        </div>
      </div>
    </div>
  );
}
