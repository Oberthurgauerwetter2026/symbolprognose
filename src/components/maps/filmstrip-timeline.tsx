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

  const dragStartRef = useRef<{ x: number; ms: number } | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  // Kinetisches Scrollen: geglättete Geschwindigkeit (ms Zeitachse pro ms Realzeit)
  const velRef = useRef(0);
  const velHistoryRef = useRef<number[]>([]);
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
    if (playing && dragMs !== null) {
      stopMomentum();
      snapAndEmit(dragMs);
      setDragMs(null);
      onScrubMs?.(null);
      velRef.current = 0;
      velHistoryRef.current = [];
    }
  }, [playing]);


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
  // Aktives Ziehen: Strip + Bubble rasten auf echte Frame-Zeiten ein.
  // Nachlauf (Momentum): Strip + Bubble folgen der kontinuierlichen Zeit.
  // Playback: Strip + Bubble folgen der aktuellen Frame-Zeit.
  const isActiveDrag = dragStartRef.current !== null;
  const isMomentum = momentumRafRef.current !== null;
  const motionMs = isActiveDrag
    ? frameMs
    : isMomentum
      ? (dragMs ?? frameMs)
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
  const velHistoryRef = useRef<number[]>([]);
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
    if (playing && dragMs !== null) {
      stopMomentum();
      snapAndEmit(dragMs);
      setDragMs(null);
      onScrubMs?.(null);
      velRef.current = 0;
      velHistoryRef.current = [];
    }
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
    velHistoryRef.current = [];
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
      if (dt > 8) {
        // px/ms -> Zeitachse ms pro Realzeit-ms (Ziehen nach links = vorwärts)
        const v = ((-(e.clientX - last.x) / PX_PER_HOUR) * 3_600_000) / dt;
        velHistoryRef.current.push(v);
        if (velHistoryRef.current.length > 4) velHistoryRef.current.shift();
        velRef.current = velHistoryRef.current.reduce((a, b) => a + b, 0) / velHistoryRef.current.length;
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
    // Feste Verzögerung für gleichmässiges Auslaufen unabhängig von der Anfangsgeschwindigkeit.
    const DECELERATION = 15_000; // ms Zeitachse pro ms Realzeit²
    const MIN_V = 1.5;

    const finish = () => {
      momentumRafRef.current = null;
      snapAndEmit(ms);
      setDragMs(null);
      onScrubMs?.(null);
      velRef.current = 0;
      velHistoryRef.current = [];
    };

    const step = () => {
      const now = performance.now();
      const dt = Math.min(48, now - prev);
      prev = now;
      ms += v * dt;

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

      // Konstante Abbremsrate
      const decel = DECELERATION * dt;
      if (v > 0) {
        v = Math.max(0, v - decel);
      } else if (v < 0) {
        v = Math.min(0, v + decel);
      }

      // Während des Nachlaufens keine Frame-Snap-Emission; nur kontinuierliche Position.
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
  velHistoryRef.current = [];
  setDragMs(null);
  onScrubMs?.(null);
};


  return (
    <div className="select-none">
      {/* Bubble über fixer Mittellinie */}
      <div className="relative h-9">
        <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold text-white shadow-md"
            style={{ background: color }}
          >
            {bubbleLabel}
          </span>
          <span
            className="h-0 w-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `6px solid ${color}`,
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
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              stopMomentum();
              if (dragMs !== null) {
                setDragMs(null);
                onScrubMs?.(null);
                velRef.current = 0;
                velHistoryRef.current = [];
              }
            }
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
        className={`relative h-12 cursor-grab touch-none overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-b from-neutral-50 to-neutral-100 shadow-inner outline-none transition-all duration-200 active:cursor-grabbing focus-visible:ring-2 ${
          dragging ? "bg-gradient-to-b from-neutral-100 to-white shadow-lg" : ""
        }`}
      >
        {/* Fixe Mittel-Linie */}
        <span
          className={`pointer-events-none absolute left-1/2 top-0 z-30 h-full -translate-x-1/2 bg-neutral-900/85 transition-all duration-200 ${
            dragging ? "w-[2px] bg-neutral-900" : "w-px"
          }`}
        />
        <span
          className={`pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 rotate-45 transition-all duration-200 ${
            dragging ? "h-3 w-3" : "h-2 w-2"
          }`}
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
