"use client";

import { useEffect, useRef } from "react";
import {
  WIDTH,
  HEIGHT,
  DOTS,
  INNER_SCALE,
  REPEL_RADIUS,
  MAX_DISPLACEMENT,
  EASE,
  SETTLE_EPSILON,
} from "./dot-field";

/**
 * **Deprecated** — kept in the codebase for reference/comparison only, no longer mounted
 * on the homepage (see `dotted-wave-background-gl.tsx`, now the default). This SVG/DOM
 * version hit a real performance ceiling: a click-triggered "pulse" effect was tried here
 * and dropped for being laggy, specifically because of the per-frame cost of touching
 * ~6000 real DOM nodes. The same pulse, re-added to the WebGL version and computed
 * entirely in a shader (zero added per-dot CPU cost), ran flawlessly — confirming the DOM
 * writes, not the effect itself, were the bottleneck.
 *
 * Ambient decorative mesh behind the homepage's navbar + hero, sized and positioned to
 * align with the document's top edge (no positioned ancestor exists between this and
 * the page root, so `top: 0` lands exactly there). Fades out horizontally well before
 * the viewport edges via a mask. Dots near the cursor are repelled away from it, easing
 * back to rest once the cursor moves on — driven imperatively (direct DOM `transform`
 * writes in a rAF loop, not React state) since doing this for ~6000 dots every frame
 * through React re-renders would not keep up.
 */
export function DottedWaveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const circles = Array.from(svg.querySelectorAll("circle"));
    const n = circles.length;
    const dx = new Float32Array(n);
    const dy = new Float32Array(n);

    const mouse = { x: 0, y: 0, active: false };
    const lastClient = { x: 0, y: 0 };
    let rafId = 0;
    let running = false;

    // Maps a screen point to this SVG's own user-space (viewBox) coordinates, or null if
    // outside the visible area. Uses `getScreenCTM()` — the browser's own purpose-built
    // API for exactly this — rather than hand-reconstructing the CSS 3D transform
    // (translate/perspective/rotateY/transform-origin) ourselves, which is exactly what
    // produced the previous, broken attempt at this.
    function toLocalPoint(clientX: number, clientY: number): { x: number; y: number } | null {
      const containerRect = container!.getBoundingClientRect();
      const inside =
        clientX >= containerRect.left &&
        clientX <= containerRect.right &&
        clientY >= containerRect.top &&
        clientY <= containerRect.bottom;
      if (!inside) return null;

      const ctm = svg!.getScreenCTM();
      if (!ctm) return null;

      const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: local.x, y: local.y };
    }

    function updateMouseFromClient(clientX: number, clientY: number) {
      lastClient.x = clientX;
      lastClient.y = clientY;
      const local = toLocalPoint(clientX, clientY);
      if (!local) {
        mouse.active = false;
        return;
      }
      mouse.x = local.x;
      mouse.y = local.y;
      mouse.active = true;
    }

    function tick() {
      let maxResidual = 0;

      for (let i = 0; i < n; i++) {
        const dot = DOTS[i];
        let targetDx = 0;
        let targetDy = 0;

        if (mouse.active) {
          const ddx = dot.x - mouse.x;
          const ddy = dot.y - mouse.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist < REPEL_RADIUS && dist > 0.001) {
            const force = (1 - dist / REPEL_RADIUS) * MAX_DISPLACEMENT;
            targetDx = (ddx / dist) * force;
            targetDy = (ddy / dist) * force;
          }
        }

        dx[i] += (targetDx - dx[i]) * EASE;
        dy[i] += (targetDy - dy[i]) * EASE;

        const mag = Math.abs(dx[i]) + Math.abs(dy[i]);
        maxResidual = Math.max(maxResidual, mag);

        if (mag > SETTLE_EPSILON) {
          circles[i].style.transform = `translate(${dx[i].toFixed(2)}px, ${dy[i].toFixed(2)}px)`;
        } else if (circles[i].style.transform) {
          circles[i].style.transform = "";
          dx[i] = 0;
          dy[i] = 0;
        }
      }

      if (mouse.active || maxResidual > SETTLE_EPSILON) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    function ensureRunning() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    function handlePointerMove(e: PointerEvent) {
      updateMouseFromClient(e.clientX, e.clientY);
      ensureRunning();
    }

    // Scrolling moves this element under an otherwise-stationary cursor, which fires no
    // pointermove event — recompute against the last known cursor position so it doesn't
    // go stale.
    function handleScroll() {
      updateMouseFromClient(lastClient.x, lastClient.y);
      ensureRunning();
    }

    function handleWindowLeave() {
      mouse.active = false;
      ensureRunning();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleWindowLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      document.documentElement.removeEventListener("mouseleave", handleWindowLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    // Outer wrapper: a plain, untransformed rectangle that defines the actual visible
    // area and clips everything to it. Kept transform-free on purpose — a transformed
    // element's projected (trapezoid) footprint can be wider than its own box, which
    // inflates the *page's* scrollable area if nothing untransformed contains it first.
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
      }}
    >
      {/*
        Vertical-fade layer: plain, untransformed, exactly the outer wrapper's size.
        Its own mask only fades the *bottom* portion to transparent (top stays fully
        opaque — nothing above it to blend into, it already starts at the document's
        true top edge). Kept on a separate element from the horizontal fade above
        rather than combined into one `mask-image` with `mask-composite`, since nesting
        two independently-masked elements intersects naturally and portably, with none
        of mask-composite's prefix/keyword cross-browser fuss.
      */}
      <div
        className="h-full w-full"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
        }}
      >
        {/*
          Inner box: the actual tilted content, rendered at 140% of the wrapper's size and
          centered, so the rotateY foreshortening still fully covers the visible area on
          both sides (clipped symmetrically by the wrapper above) instead of running out of
          content on the receding (left) edge.
        */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${INNER_SCALE * 100}%`,
            height: `${INNER_SCALE * 100}%`,
            // Static 3D tilt (no animation involved, so plain CSS rather than Motion) —
            // negative rotateY brings the right edge toward the viewer (bigger) and recedes
            // the left edge (smaller). Cursor/click targeting through this tilt is handled
            // via `getScreenCTM()` on the SVG itself (see the effect above), not by
            // reasoning about this transform directly.
            transform: "translate(-50%, -50%) perspective(1000px) rotateY(-16deg)",
          }}
        >
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
            {DOTS.map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} style={{ fill: dot.color }} opacity={dot.opacity} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
