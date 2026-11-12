"use client";

import { useEffect, useRef } from "react";
import {
  WIDTH,
  HEIGHT,
  DOTS,
  DOT_RADIUS,
  DOT_OPACITY,
  INNER_SCALE,
  REPEL_RADIUS,
  MAX_DISPLACEMENT,
  EASE,
  SETTLE_EPSILON,
  hexToRgb01,
  resolveGraphicsColorHex,
} from "./dot-field";

// Each `dot.color` is a `"var(--graphics-N)"` string (see dot-field.ts), not a literal hex —
// resolved here, once per unique string, rather than per dot.
function extractVarName(colorExpr: string): string | null {
  const match = colorExpr.match(/var\((--[\w-]+)\)/);
  return match ? match[1] : null;
}

// Click-pulse tuning, in the same 1200x420 viewBox units/seconds as everything else. This
// is the same effect that was tried and dropped from the DOM version for being laggy —
// re-added here, computed entirely on the GPU (see the shaders below) so re-adding it costs
// zero extra CPU work per dot, to actually test whether the DOM version's lagginess was the
// per-frame DOM writes (expected) or the pulse math itself (not expected).
const PULSE_SPEED = 900; // outward wavefront speed
const PULSE_DURATION_SEC = 1.6; // self-cancelling — see `pulse.active` handling below
const PULSE_BAND_WIDTH = 55; // half-width of the traveling ring
const PULSE_SIZE_BOOST = 1.6; // gl_PointSize multiplier at full influence
const PULSE_WHITE_BLEND = 0.85; // color-to-white mix at full influence
const PULSE_ALPHA_BOOST = 0.6; // extra opacity at full influence

const VERTEX_SRC = `
attribute vec2 aPosition;
attribute vec3 aColor;
attribute vec2 aOffset;
uniform vec2 uResolution;
uniform float uPixelSize;
uniform float uPulseActive;
uniform vec2 uPulseOrigin;
uniform float uPulseElapsed;
varying vec3 vColor;
varying float vPulse;

const float PULSE_SPEED = ${PULSE_SPEED.toFixed(1)};
const float PULSE_DURATION = ${PULSE_DURATION_SEC.toFixed(2)};
const float PULSE_BAND_WIDTH = ${PULSE_BAND_WIDTH.toFixed(1)};
const float PULSE_SIZE_BOOST = ${PULSE_SIZE_BOOST.toFixed(2)};
const float PULSE_WHITE_BLEND = ${PULSE_WHITE_BLEND.toFixed(2)};

void main() {
  vec2 pos = aPosition + aOffset;

  float pulse = 0.0;
  if (uPulseActive > 0.5) {
    float dist = length(pos - uPulseOrigin);
    float radius = uPulseElapsed * PULSE_SPEED;
    float bandDist = abs(dist - radius);
    float decay = clamp(1.0 - uPulseElapsed / PULSE_DURATION, 0.0, 1.0);
    if (bandDist < PULSE_BAND_WIDTH) {
      pulse = (1.0 - bandDist / PULSE_BAND_WIDTH) * decay;
    }
  }

  vec2 clip = vec2(
    (pos.x / uResolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / uResolution.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPixelSize * (1.0 + PULSE_SIZE_BOOST * pulse);
  vColor = mix(aColor, vec3(1.0), PULSE_WHITE_BLEND * pulse);
  vPulse = pulse;
}
`;

const FRAGMENT_SRC = `
precision mediump float;
varying vec3 vColor;
varying float vPulse;
uniform float uOpacity;

const float PULSE_ALPHA_BOOST = ${PULSE_ALPHA_BOOST.toFixed(2)};

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  if (dot(c, c) > 0.25) discard;
  float alpha = clamp(uOpacity + PULSE_ALPHA_BOOST * vPulse, 0.0, 1.0);
  gl_FragColor = vec4(vColor, alpha);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Second, parallel implementation of the exact same dot mesh as `DottedWaveBackground`
 * (same geometry/colors, from `./dot-field`) — one GPU buffer + one `gl.POINTS` draw call
 * instead of one `<circle>` DOM node per dot. Built to compare against the DOM version,
 * which is **not replaced**; this is not mounted anywhere by default (see the toggle on
 * the homepage).
 *
 * The repulsion *physics* (easing toward a mouse-driven target) still runs on the CPU,
 * every frame, over the same plain Float32Arrays the DOM version uses — that part isn't
 * the bottleneck. The difference is the render sink: instead of writing a `style.transform`
 * to ~6000 individual DOM nodes, the same per-dot offsets are copied into one Float32Array
 * and uploaded to the GPU with a single `bufferSubData` call, then drawn in one call. That
 * swap is exactly what the dropped click-pulse feature was blocked on in the DOM version.
 */
export function DottedWaveBackgroundGL() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!container || !svg || !canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const n = DOTS.length;
    const positions = new Float32Array(n * 2);
    const colors = new Float32Array(n * 3);
    const offsets = new Float32Array(n * 2);
    const dx = new Float32Array(n);
    const dy = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      positions[i * 2] = DOTS[i].x;
      positions[i * 2 + 1] = DOTS[i].y;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    const aColor = gl.getAttribLocation(program, "aColor");
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

    // Resolved once per unique `dot.color` string (4 of them), then looked up per dot —
    // re-run whenever the theme class on <html> changes (see the MutationObserver below),
    // since the actual RGB values live in CSS custom properties, not in `DOTS` itself.
    function uploadColors() {
      const lookup = new Map<string, [number, number, number]>();
      for (let i = 0; i < n; i++) {
        const key = DOTS[i].color;
        let rgb = lookup.get(key);
        if (!rgb) {
          const varName = extractVarName(key);
          const hex = varName ? resolveGraphicsColorHex(varName) : "#888888";
          rgb = hexToRgb01(hex);
          lookup.set(key, rgb);
        }
        colors[i * 3] = rgb[0];
        colors[i * 3 + 1] = rgb[1];
        colors[i * 3 + 2] = rgb[2];
      }
      gl!.bindBuffer(gl!.ARRAY_BUFFER, colorBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, colors, gl!.STATIC_DRAW);
    }
    uploadColors();

    const offsetBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.DYNAMIC_DRAW);
    const aOffset = gl.getAttribLocation(program, "aOffset");
    gl.enableVertexAttribArray(aOffset);
    gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uPixelSize = gl.getUniformLocation(program, "uPixelSize");
    const uOpacity = gl.getUniformLocation(program, "uOpacity");
    const uPulseActive = gl.getUniformLocation(program, "uPulseActive");
    const uPulseOrigin = gl.getUniformLocation(program, "uPulseOrigin");
    const uPulseElapsed = gl.getUniformLocation(program, "uPulseElapsed");
    gl.uniform2f(uResolution, WIDTH, HEIGHT);
    gl.uniform1f(uOpacity, DOT_OPACITY);
    gl.uniform1f(uPulseActive, 0);

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(1, Math.round(rect.width * dpr));
      const displayHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas!.width !== displayWidth || canvas!.height !== displayHeight) {
        canvas!.width = displayWidth;
        canvas!.height = displayHeight;
      }
      gl!.viewport(0, 0, displayWidth, displayHeight);
      // gl_PointSize is isotropic (a true circle), while the SVG version's viewBox is
      // stretched non-uniformly (preserveAspectRatio="none") — close enough visually at
      // r=1px that it's not worth a per-axis correction here.
      const pixelsPerUnit = displayWidth / WIDTH;
      gl!.uniform1f(uPixelSize, DOT_RADIUS * 2 * pixelsPerUnit);
    }

    function draw() {
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.POINTS, 0, n);
    }

    resize();
    draw();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(canvas);

    // next-themes toggles a class (`light`/`dark`/`matrix`) on <html> — colors are baked
    // into a GPU buffer at upload time (unlike plain CSS, which just re-resolves `var()` on
    // repaint), so a theme switch needs an explicit re-upload + redraw to actually show up.
    const themeObserver = new MutationObserver(() => {
      uploadColors();
      draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mouse = { x: 0, y: 0, active: false };
    const lastClient = { x: 0, y: 0 };
    const pulse = { active: false, x: 0, y: 0, startTime: 0 };
    let rafId = 0;
    let running = false;

    // Same `getScreenCTM()`-based mapping as the DOM version, via an invisible SVG
    // (same viewBox, same CSS ancestry/tilt, zero children) rendered alongside the
    // canvas purely so this component doesn't have to re-derive the CSS 3D transform
    // math by hand.
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

        offsets[i * 2] = dx[i];
        offsets[i * 2 + 1] = dy[i];
      }

      gl!.bindBuffer(gl!.ARRAY_BUFFER, offsetBuffer);
      gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, offsets);

      let pulseElapsedSec = 0;
      if (pulse.active) {
        pulseElapsedSec = (performance.now() - pulse.startTime) / 1000;
        if (pulseElapsedSec > PULSE_DURATION_SEC) pulse.active = false;
      }
      gl!.uniform1f(uPulseActive, pulse.active ? 1 : 0);
      if (pulse.active) {
        gl!.uniform2f(uPulseOrigin, pulse.x, pulse.y);
        gl!.uniform1f(uPulseElapsed, pulseElapsedSec);
      }

      draw();

      if (mouse.active || maxResidual > SETTLE_EPSILON || pulse.active) {
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

    function handleScroll() {
      updateMouseFromClient(lastClient.x, lastClient.y);
      ensureRunning();
    }

    function handleWindowLeave() {
      mouse.active = false;
      ensureRunning();
    }

    function handleClick(e: MouseEvent) {
      const local = toLocalPoint(e.clientX, e.clientY);
      if (!local) return;
      pulse.active = true;
      pulse.x = local.x;
      pulse.y = local.y;
      pulse.startTime = performance.now();
      ensureRunning();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("click", handleClick);
    document.documentElement.addEventListener("mouseleave", handleWindowLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("click", handleClick);
      document.documentElement.removeEventListener("mouseleave", handleWindowLeave);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
      }}
    >
      <div
        className="h-full w-full"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${INNER_SCALE * 100}%`,
            height: `${INNER_SCALE * 100}%`,
            transform: "translate(-50%, -50%) perspective(1000px) rotateY(-16deg)",
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ visibility: "hidden" }}
          />
        </div>
      </div>
    </div>
  );
}
