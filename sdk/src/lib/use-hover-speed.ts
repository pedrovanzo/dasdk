"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  useMotionValue,
  type DOMKeyframesDefinition,
  type AnimationOptions,
  type MotionValue,
} from "motion/react";

// Multiplier applied to an animation's own base duration (effective duration = base * scale).
// Smaller = faster.
const SCALE = {
  fast: 0.4,
  medium: 0.65,
  slow: 3.6,
};

const EASE_TRANSITION = { duration: 0.6, ease: "easeInOut" as const };

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
 * Drives an animation's speed multiplier: fast by default, easing to a much
 * slower, slow-motion pace while hovered/focused on devices that support
 * hover. Touch devices (no hover to slow down on) get a constant medium pace
 * instead. Returns the raw motion value, not a React state number — a
 * re-render per tick can't actually change an already-playing infinite
 * animation's rate, only a live `.speed` mutation can (see
 * `useLoopAnimation` below).
 */
export function useHoverSpeed() {
  const hasHover = useHasHover();
  const [active, setActive] = useState(false);
  const scaleValue = useMotionValue(SCALE.fast);

  useEffect(() => {
    const target = !hasHover ? SCALE.medium : active ? SCALE.slow : SCALE.fast;
    const controls = animate(scaleValue, target, EASE_TRANSITION);
    return () => controls.stop();
  }, [hasHover, active, scaleValue]);

  return {
    scaleValue,
    hoverHandlers: {
      onMouseEnter: () => setActive(true),
      onMouseLeave: () => setActive(false),
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  };
}

/**
 * Starts a looping DOM animation once and keeps it running at a fixed base
 * pace, then live-adjusts its *playback speed* whenever `scaleValue` changes
 * (speed = 1 / scale) instead of recreating the animation on every change.
 * Changing `transition.duration` on an already-playing `repeat: Infinity`
 * animation has no effect until it restarts — mutating `.speed` on the
 * running `AnimationPlaybackControls` is what actually makes the
 * hover-driven speed change (and its ease) visible immediately, without a
 * remount.
 */
export function useLoopAnimation<T extends Element>(
  keyframes: DOMKeyframesDefinition,
  baseTransition: AnimationOptions,
  scaleValue: MotionValue<number>,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const controls = animate(ref.current, keyframes, { ...baseTransition, repeat: Infinity });
    controls.speed = 1 / scaleValue.get();
    const unsubscribe = scaleValue.on("change", (v) => {
      controls.speed = 1 / v;
    });
    return () => {
      unsubscribe();
      controls.stop();
    };
    // keyframes/baseTransition are meant to be static per call site (module-level
    // constants); only scaleValue identity should ever restart this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleValue]);

  return ref;
}
