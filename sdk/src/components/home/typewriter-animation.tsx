"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { speedScale, type AnimSpeed } from "@/lib/use-hover-speed";

const LINES = [
  "An agent calls tools in a loop.",
  "An eval grades it against known cases.",
  "A skill is loaded on demand.",
];

/** A looping typewriter effect over a small set of lines. Speed-reactive via the `speed` prop. */
export function TypewriterAnimation({ speed }: { speed: AnimSpeed }) {
  const scale = speedScale(speed);
  const [lineIndex, setLineIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const line = LINES[lineIndex];
    const typeMs = 55 * scale;
    const deleteMs = 30 * scale;
    const holdMs = 1100 * scale;

    if (!deleting && charCount < line.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), typeMs);
      return () => clearTimeout(t);
    }
    if (!deleting && charCount === line.length) {
      const t = setTimeout(() => setDeleting(true), holdMs);
      return () => clearTimeout(t);
    }
    if (deleting && charCount > 0) {
      const t = setTimeout(() => setCharCount((c) => c - 1), deleteMs);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setDeleting(false);
      setLineIndex((i) => (i + 1) % LINES.length);
    }, deleteMs);
    return () => clearTimeout(t);
  }, [charCount, deleting, lineIndex, scale]);

  const text = LINES[lineIndex].slice(0, charCount);

  return (
    <div className="flex h-full w-full max-w-xs flex-col justify-center gap-2 px-4 font-mono text-sm text-foreground/70">
      <p className="min-h-[2.5em]">
        {text}
        <motion.span
          className="inline-block w-[2px] translate-y-[1px] bg-foreground/70 align-middle"
          style={{ height: "1em" }}
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        />
      </p>
    </div>
  );
}
