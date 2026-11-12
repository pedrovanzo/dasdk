// Shared geometry/constants behind both `DottedWaveBackground` (SVG/DOM) and
// `DottedWaveBackgroundGL` (WebGL) — the two are meant to render the exact same
// mesh of dots, so the curve/line/color math lives here once rather than twice.

export const WIDTH = 1200;
export const HEIGHT = 420;

// The 4-color cycle used for every dot/trace across the homepage's decorative graphics
// (this header mesh, the circuit/graph-fill card animations) — driven by CSS custom
// properties, not baked-in hex, so a theme switch (see `theme-provider.tsx`) recolors them
// without any of this module's geometry being regenerated. `.matrix` in globals.css
// overrides these four to green shades; `.dark` reuses the same values as `:root`.
export const GRAPHICS_VARS = ["--graphics-1", "--graphics-2", "--graphics-3", "--graphics-4"];

type Point = [number, number];
export type Dot = { x: number; y: number; r: number; opacity: number; color: string };

/**
 * Resolves one of `GRAPHICS_VARS` to its current literal value (e.g. `"#22d3ee"`). CSS
 * custom properties hold exactly the text they were authored with — unlike a resolved
 * color (which browsers may normalize to e.g. `rgb(...)`), `getComputedStyle(...).
 * getPropertyValue()` on a custom property returns that literal string back, so this stays
 * compatible with `hexToRgb01` below even though the source values are defined in a plain
 * CSS theme block, not passed through JS.
 */
export function resolveGraphicsColorHex(varName: string): string {
  if (typeof window === "undefined") return "#888888";
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || "#888888";
}

// Floating-point arithmetic (even plain +/-/* , not just Math.sin()) can differ in its
// last binary digit between the server's and the browser's JS engine build, which turns
// into a hydration mismatch once that float is stringified into an SVG attribute.
// Rounding removes that last-bit sensitivity.
function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Builds one "spine" curve: a horizontal line with `weights.length` alternating
 * peaks/valleys. Each segment's width is proportional to its own weight. Segments are
 * smoothed with cubic Beziers carrying a horizontal tangent at every peak/valley, so it
 * still reads as one continuous flowing line.
 */
function buildSpine(options: {
  width: number;
  baseline: number;
  amplitude: number;
  weights: number[];
  dotSpacing: number;
}): Point[] {
  const { width, baseline, amplitude, weights, dotSpacing } = options;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const extrema: Point[] = [[0, baseline]];
  let x = 0;
  weights.forEach((w, i) => {
    x += (w / totalWeight) * width;
    extrema.push([x, i % 2 === 0 ? baseline - amplitude : baseline + amplitude]);
  });

  const points: Point[] = [];
  for (let i = 0; i < extrema.length - 1; i++) {
    const [x0, y0] = extrema[i];
    const [x1, y1] = extrema[i + 1];
    const handle = (x1 - x0) * 0.5;
    const p0: Point = [x0, y0];
    const p1: Point = [x0 + handle, y0];
    const p2: Point = [x1 - handle, y1];
    const p3: Point = [x1, y1];
    const steps = Math.max(2, Math.round((x1 - x0) / dotSpacing));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      points.push(cubicPoint(p0, p1, p2, p3, s / steps));
    }
  }
  return points;
}

/**
 * Repeats one spine as parallel copies spanning `rangeStart`..`rangeEnd` (not a fixed
 * count centered on a point) — conceptually "infinite" in both directions, so there's
 * never a hard edge where lines just stop inside the visible area.
 */
function buildParallelLines(
  spine: Point[],
  options: { spacing: number; rangeStart: number; rangeEnd: number; dotRadius: number; opacity: number },
): Dot[] {
  const { spacing, rangeStart, rangeEnd, dotRadius, opacity } = options;
  const dots: Dot[] = [];
  let i = 0;

  for (let dy = rangeStart; dy <= rangeEnd; dy += spacing, i++) {
    const color = `var(${GRAPHICS_VARS[i % GRAPHICS_VARS.length]})`;
    for (const [x, y] of spine) {
      dots.push({ x: round(x), y: round(y + dy), r: dotRadius, opacity, color });
    }
  }
  return dots;
}

// One shared shape for every line: first 5 weights (left half) drawn from a tight
// ~0.5-0.7 range, last 5 (right half) from a wide ~1.3-1.75 range — small-but-varying
// humps on the left, large-but-varying humps on the right. Every line repeats this exact
// shape, only offset vertically and recolored.
const SHARED_WEIGHTS = [0.65, 0.55, 0.5, 0.6, 0.7, 1.7, 1.4, 1.6, 1.3, 1.5];
const SHARED_SPINE = buildSpine({ width: WIDTH, baseline: 0, amplitude: 11, weights: SHARED_WEIGHTS, dotSpacing: 5 });

// Overscan well past the 0..HEIGHT visible range on both ends — see buildParallelLines.
export const DOTS: Dot[] = buildParallelLines(SHARED_SPINE, {
  spacing: 22,
  rangeStart: -40,
  rangeEnd: HEIGHT + 80,
  dotRadius: 1,
  opacity: 0.9,
});

export const DOT_RADIUS = 1;
export const DOT_OPACITY = 0.9;

// How much bigger the inner tilted box is than its outer (untransformed) wrapper.
export const INNER_SCALE = 1.4;

// Cursor-repulsion tuning, in the same 1200x420 viewBox units as the dots themselves.
export const REPEL_RADIUS = 70;
export const MAX_DISPLACEMENT = 16;
export const EASE = 0.18;
export const SETTLE_EPSILON = 0.03;

export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
