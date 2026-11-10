"use client";

import { motion } from "motion/react";
import { Bot } from "lucide-react";
import { speedScale, type AnimSpeed } from "@/lib/use-hover-speed";

const COLORS = ["#22d3ee", "#a855f7", "#f472b6", "#fb923c"];

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

/** A looping "current radiating from a chip" animation. Speed-reactive via the `speed` prop. */
export function CircuitAnimation({ speed }: { speed: AnimSpeed }) {
  const scale = speedScale(speed);

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
            stroke={COLORS[i % COLORS.length]}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            style={{ filter: `drop-shadow(0 0 2px ${COLORS[i % COLORS.length]})` }}
          />
        ))}
        {TRACES.map((d, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <motion.circle
              key={`pulse-${d}`}
              r={3}
              fill={color}
              style={{ offsetPath: `path("${d}")`, filter: `drop-shadow(0 0 3px ${color})` }}
              animate={{ offsetDistance: ["0%", "100%"] }}
              transition={{
                duration: (2 + i * 0.25) * scale,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.3 * scale,
              }}
            />
          );
        })}
      </svg>
      <div className="absolute left-[40%] top-[35%] flex h-[30%] w-[20%] flex-col items-center justify-center gap-1 rounded-lg border border-white/20 bg-black/80">
        <Bot className="h-4 w-4 text-white" aria-hidden />
        <span className="text-[10px] font-semibold tracking-wide text-white">dasdk</span>
      </div>
    </div>
  );
}
