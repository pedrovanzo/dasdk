"use client";

import { ArrowUp } from "lucide-react";
import type { MotionValue } from "motion/react";
import { useLoopAnimation } from "@/lib/use-hover-speed";

// Period-100 wavy path, spans well past the 0-300 viewBox so it can loop by
// translating exactly one period without a visible seam.
const WAVE_D =
  "M-100 130 C -50 100, 0 160, 50 130 S 150 100, 200 130 S 300 160, 350 130 S 450 100, 500 130 S 600 160, 650 130 S 750 100, 800 130";

const LINE_D = "M20 150 L68 165 L116 140 L164 150 L212 110 L260 90";
const POINTS: Array<[number, number]> = [
  [20, 150], [68, 165], [116, 140], [164, 150], [212, 110], [260, 90],
];

// Stable references across re-renders — motion treats a new array/object literal as a
// new animation target and restarts from scratch.
const WAVE_SHIFT = { x: [0, -100] };
const DRAW_KEYFRAMES = { pathLength: [0, 1, 1] };
const BADGE_KEYFRAMES = { opacity: [0, 0, 1, 1, 0], scale: [0.8, 0.8, 1, 1, 0.8] };

/** A looping "line graph filling up" animation over a slow ambient wave backdrop. Speed-reactive via the `scaleValue` prop (smaller = faster). */
export function GraphFillAnimation({ scaleValue }: { scaleValue: MotionValue<number> }) {
  const waveFrontRef = useLoopAnimation<SVGGElement>(WAVE_SHIFT, { duration: 5, ease: "linear" }, scaleValue);
  const waveBackRef = useLoopAnimation<SVGGElement>(WAVE_SHIFT, { duration: 7, ease: "linear" }, scaleValue);
  const lineRef = useLoopAnimation<SVGPathElement>(
    DRAW_KEYFRAMES,
    { duration: 1.6, times: [0, 0.6, 1], ease: "easeInOut" },
    scaleValue,
  );
  const badgeRef = useLoopAnimation<HTMLDivElement>(
    BADGE_KEYFRAMES,
    { duration: 1.6, times: [0, 0.55, 0.65, 0.9, 1], ease: "easeInOut" },
    scaleValue,
  );

  return (
    <div
      className="relative flex aspect-[3/2] w-full max-w-sm items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10"
      style={{ background: "radial-gradient(ellipse at top, #0b1826 0%, #030508 80%)" }}
    >
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <g ref={waveFrontRef}>
          <path d={WAVE_D} fill="none" strokeOpacity={0.25} strokeWidth={1.5} style={{ stroke: "var(--graphics-1)" }} />
        </g>
        <g transform="translate(0 20) scale(1 0.6)">
          <g ref={waveBackRef}>
            <path d={WAVE_D} fill="none" strokeOpacity={0.18} strokeWidth={1.5} style={{ stroke: "var(--graphics-1)" }} />
          </g>
        </g>

        <path
          ref={lineRef}
          d={LINE_D}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--graphics-1)", filter: "drop-shadow(0 0 3px var(--graphics-1))" }}
        />
        {POINTS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} style={{ fill: "var(--graphics-1)" }} />
        ))}
      </svg>

      <div
        ref={badgeRef}
        className="absolute flex items-center gap-0.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30"
        style={{ left: "78%", top: "35%" }}
      >
        <ArrowUp className="h-2.5 w-2.5" aria-hidden />
        72%
      </div>
    </div>
  );
}
