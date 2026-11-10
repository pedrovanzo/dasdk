"use client";

import { motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { speedScale, type AnimSpeed } from "@/lib/use-hover-speed";

// Period-100 wavy path, spans well past the 0-300 viewBox so it can loop by
// translating exactly one period without a visible seam.
const WAVE_D =
  "M-100 130 C -50 100, 0 160, 50 130 S 150 100, 200 130 S 300 160, 350 130 S 450 100, 500 130 S 600 160, 650 130 S 750 100, 800 130";

const LINE_D = "M20 150 L68 165 L116 140 L164 150 L212 110 L260 90";
const POINTS: Array<[number, number]> = [
  [20, 150], [68, 165], [116, 140], [164, 150], [212, 110], [260, 90],
];

/** A looping "line graph filling up" animation over a slow ambient wave backdrop. Speed-reactive via the `speed` prop. */
export function GraphFillAnimation({ speed }: { speed: AnimSpeed }) {
  const scale = speedScale(speed);
  const duration = 3 * scale;

  return (
    <div
      className="relative flex aspect-[3/2] w-full max-w-sm items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10"
      style={{ background: "radial-gradient(ellipse at top, #0b1826 0%, #030508 80%)" }}
    >
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <motion.g
          animate={{ x: [0, -100] }}
          transition={{ duration: 10 * scale, repeat: Infinity, ease: "linear" }}
        >
          <path d={WAVE_D} fill="none" stroke="#2dd4bf" strokeOpacity={0.25} strokeWidth={1.5} />
        </motion.g>
        <g transform="translate(0 20) scale(1 0.6)">
          <motion.g
            animate={{ x: [0, -100] }}
            transition={{ duration: 14 * scale, repeat: Infinity, ease: "linear" }}
          >
            <path d={WAVE_D} fill="none" stroke="#5eead4" strokeOpacity={0.18} strokeWidth={1.5} />
          </motion.g>
        </g>

        <motion.path
          d={LINE_D}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 3px #2dd4bf)" }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1] }}
          transition={{ duration, times: [0, 0.6, 1], repeat: Infinity, ease: "easeInOut" }}
        />
        {POINTS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill="#2dd4bf" />
        ))}
      </svg>

      <motion.div
        className="absolute flex items-center gap-0.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30"
        style={{ left: "78%", top: "35%" }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.8, 0.8, 1, 1, 0.8] }}
        transition={{ duration, times: [0, 0.55, 0.65, 0.9, 1], repeat: Infinity, ease: "easeInOut" }}
      >
        <ArrowUp className="h-2.5 w-2.5" aria-hidden />
        72%
      </motion.div>
    </div>
  );
}
