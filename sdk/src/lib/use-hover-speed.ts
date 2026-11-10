"use client";

import { useEffect, useState } from "react";

export type AnimSpeed = "slow" | "medium" | "fast";

/** Multiplier applied to an animation's "slow" baseline duration. Smaller = faster. */
export function speedScale(speed: AnimSpeed): number {
  switch (speed) {
    case "fast":
      return 0.35;
    case "medium":
      return 0.6;
    case "slow":
    default:
      return 1;
  }
}

function useHasHover() {
  const [hasHover, setHasHover] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHasHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return hasHover;
}

/**
 * Drives an animation's speed: slow by default, fast while hovered/focused on
 * devices that support hover, and a constant medium speed on touch devices
 * (where there's no hover to speed up on).
 */
export function useHoverSpeed() {
  const hasHover = useHasHover();
  const [active, setActive] = useState(false);

  const speed: AnimSpeed = !hasHover ? "medium" : active ? "fast" : "slow";

  return {
    speed,
    hoverHandlers: {
      onMouseEnter: () => setActive(true),
      onMouseLeave: () => setActive(false),
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  };
}
