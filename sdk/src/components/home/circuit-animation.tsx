"use client";

import { Bot } from "lucide-react";
import type { MotionValue } from "motion/react";
import { useLoopAnimation } from "@/lib/use-hover-speed";

// CSS vars, not literal hex, so a theme switch (see `theme-provider.tsx`) recolors these —
// `.matrix` in globals.css overrides them to green shades.
const COLORS = ["var(--graphics-1)", "var(--graphics-2)", "var(--graphics-3)", "var(--graphics-4)"];

// Traces radiate outward from a center chip (roughly x:120-180, y:70-130 in a 300x200 box),
// each bending several times before reaching an edge. Some corners are cut at 45 degrees
// (L segments with equal dx/dy) rather than squared off, matching real PCB trace chamfers.
const TRACES = [
  "M128 70 V50 L108 30 H60 V0",
  "M150 70 V45 H180 L200 25 V0",
  "M172 70 V55 H230 V25 H300",
  "M128 130 V150 L108 170 H40 V200",
  "M150 130 V160 H220 V190 H300",
  "M172 130 V145 H100 L80 165 V200",
  "M120 78 H90 L70 58 V20 H0",
  "M120 100 H80 V60 H30 V130 H0",
  "M120 122 H85 L65 142 V200",
  "M180 78 H210 L230 58 V0",
  "M180 100 H220 V70 H270 V130 H300",
  "M180 122 H210 L230 142 V180 H300",
];

// Stable reference across re-renders — motion treats a new object literal as a new
// animation target, which would jump the pulse back to its start on every call.
const PULSE_KEYFRAMES = { offsetDistance: ["0%", "100%"] };

function Pulse({
  d,
  color,
  baseDuration,
  baseDelay,
  scaleValue,
}: {
  d: string;
  color: string;
  baseDuration: number;
  baseDelay: number;
  scaleValue: MotionValue<number>;
}) {
  const ref = useLoopAnimation<SVGCircleElement>(
    PULSE_KEYFRAMES,
    { duration: baseDuration, delay: baseDelay, ease: "linear" },
    scaleValue,
  );

  return (
    <circle
      ref={ref}
      r={3}
      style={{ fill: color, offsetPath: `path("${d}")`, filter: `drop-shadow(0 0 3px ${color})` }}
    />
  );
}

/** A looping "current radiating from a chip" animation. Speed-reactive via the `scaleValue` prop (smaller = faster). */
export function CircuitAnimation({ scaleValue }: { scaleValue: MotionValue<number> }) {
  return (
    <div
      className="relative flex aspect-[3/2] w-full max-w-sm items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10"
      style={{ background: "radial-gradient(ellipse at center, #1e1140 0%, #0a0616 75%)" }}
    >
      <svg viewBox="0 0 300 200" className="h-full w-full" aria-hidden>
        {TRACES.map((d, i) => (
          <path
            key={d}
            d={d}
            fill="none"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            style={{
              stroke: COLORS[i % COLORS.length],
              filter: `drop-shadow(0 0 2px ${COLORS[i % COLORS.length]})`,
            }}
          />
        ))}
        {TRACES.map((d, i) => (
          <Pulse
            key={`pulse-${d}`}
            d={d}
            color={COLORS[i % COLORS.length]}
            baseDuration={0.9 + i * 0.12}
            baseDelay={i * 0.15}
            scaleValue={scaleValue}
          />
        ))}
      </svg>
      <div className="absolute left-[40%] top-[35%] flex h-[30%] w-[20%] flex-col items-center justify-center gap-1 rounded-lg border border-white/20 bg-black/80">
        <Bot className="h-4 w-4 text-white" aria-hidden />
        <span className="text-[10px] font-semibold tracking-wide text-white">dasdk</span>
      </div>
    </div>
  );
}
