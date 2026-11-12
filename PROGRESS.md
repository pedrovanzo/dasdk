# dasdk — progress & handoff

Written 2026-11-06 to resume work in a fresh context window. This is a status
snapshot, not a replacement for `DECISIONS.md` (root) or
`agents/diver/DECISIONS.md` — those remain the authoritative decision logs.
Read this first for orientation, then go to those two files for the "why"
behind anything mentioned here.

## What dasdk is

Public GitHub portfolio monorepo: https://github.com/pedrovanzo/dasdk (MIT,
account `pedrovanzo`). Three pieces: `sdk` (agent harness), `scaffold` (agent
generator, not started), `agents/*` (real + demo agents). Built to showcase
to the user's manager and informally to job applications — never state the
job-hunting motive in repo docs. Full origin story and every architecture
decision: `DECISIONS.md` at repo root.

Stack: Next.js 16 (App Router, Turbopack, "Cache Components" feature —
see gotchas below), shadcn/ui on **Base UI** (not Radix — API differs, see
gotchas), Tailwind, Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`,
`@ai-sdk/openai`), Zod, pnpm workspaces (no Turborepo). No server-held API
keys anywhere — visitors paste their own provider key, stored only in
browser localStorage.

## Repo layout (flat, no `packages/` wrapper)

```
dasdk/
  DECISIONS.md              — root architecture decision log (read this)
  sdk/                       — the Next.js app (the only thing with real code so far)
  scaffold/                  — just a README, not started
  agents/
    diver/                   — fully implemented, real logic + UI
      DECISIONS.md           — Diver-specific decision log (read this too)
      src/                   — standalone workspace package, "diver" on npm-workspace-local scope
    web-search-agent/         — just a README, not started (toy agent, TS flavor)
    image-reader/             — just a README, not started (toy agent, Python flavor)
```

## What's built and verified working

### sdk shell
- Routed pages (not a sidebar SPA, per locked decision): `/`, `/docs`,
  `/agents`, `/agents/[agent]`, `/agents/[agent]/evals`. The two dynamic
  routes are fully static via `generateStaticParams` for the 3 known agent
  slugs, with `export const instant = false` to opt out of Next 16's new
  instant-navigation validation (see gotchas).
- `/docs` has the six-section outline from the original grilling session,
  hardcoded content (not dynamic).
- Font: Geist Sans/Mono (default, via `next/font/google`, variable named
  `--font-sans` to match what `globals.css`/Tailwind expects — see gotchas).

### Provider key input
- `sdk/src/lib/use-api-key.ts` — credential `{providerId, apiKey}` lives in
  `localStorage` via `useSyncExternalStore` (not plain `useState`+`useEffect`
  — that pattern trips the `react-hooks/set-state-in-effect` lint rule).
  Never sent anywhere except the per-request proxy calls below.
- `sdk/src/components/api-key-dialog.tsx` — nav dialog to connect/disconnect,
  shows a "get a free key" link per provider.
- `sdk/src/lib/providers.ts` — the 3 supported providers (Gemini, Anthropic,
  OpenAI, locked for v1) + `DEFAULT_MODELS` (currently
  `gemini-3.8-flash` / `claude-haiku-4-5-20251001` / `gpt-4.1-mini` — the
  Gemini one was already bumped once after `gemini-2.0-flash` got deprecated
  mid-project; check live if you see a "model no longer available" error
  again, Google retires these fast).

### Thin serverless proxy
- `sdk/src/app/api/chat/route.ts` — generic POST: `{providerId, apiKey,
  model, prompt, system}` → streams back via `toUIMessageStreamResponse`
  (not the deprecated `toTextStreamResponse` — that one silently returns an
  empty 200 on provider errors instead of surfacing them).
- `sdk/src/lib/resolve-model.ts` — shared provider-adapter resolver, used by
  every route that talks to a model.

### Diver — fully implemented, the flagship agent
Two modes, both working, both tested against the real running dev server:

**Quick check** (`sdk/src/components/diver-quick-check.tsx` →
`POST /api/diver`): paste full raw email source, all 5 checks always run
deterministically, no key needed. Optional narration if a key is connected.
This is the original, simpler mode — kept exactly as-is through all later
changes.

**Agent session** (`sdk/src/components/diver-agent-session.tsx` →
`POST /api/diver/session`): accepts text (bare address, URL, short text, or
full headers) or an image. Architecture:
1. **Planner** (one model call, skipped entirely for full-header text —
   deterministic parsing handles that case directly) — decides which checks
   apply and extracts structured fields. Never grades anything.
2. **Deterministic execution** (no model) — runs exactly the Planner's
   chosen checks via `agents/diver/src/session.ts`'s dispatch table, the
   single source of truth shared by both modes.
3. **Narrator** (one model call) — plain-language summary. Still can't
   override check results.

The five checks themselves (`agents/diver/src/checks/*.ts`): homoglyph /
typosquat, SPF/DKIM/DMARC (`auth-results`), reply-to mismatch, known-brand
allowlist (with a native-web-search fallback hook, not yet wired to an
actual search call — `BrandLookup` type exists, nothing implements it),
and an SSRF-guarded link-redirect resolver (HEAD-only, blocks
private/loopback/link-local IPs including the cloud metadata endpoint,
caps redirect hops). All individually smoke-tested; one real bug was found
and fixed via testing (github.com false-flagged as a gitlab.com typosquat —
fixed by short-circuiting when the sender domain is itself a known brand).

**Two model backends**, both selectable in Agent session, auto-detected at
runtime:
- **Provider key** (Gemini/Anthropic/OpenAI) — `generateObject` for the
  Planner (schema-enforced structured output, supports multimodal image
  input directly), `generateText` for the Narrator.
- **Claude Code CLI** (dev-only, rides the developer's own subscription via
  `child_process.execFile("claude", ["-p", ...])`, same pattern as
  `~/Desktop/prompt-eval`) — no structured-output enforcement available, so
  the Planner prompt spells out the literal JSON shape and
  `extractJsonFromText` does a balanced-brace scan to pull a JSON object out
  of whatever the CLI returns. **Supports multiple accounts** — the user's
  `claude-work`/`claude-personal` shell functions turned out to just set
  `CLAUDE_CONFIG_DIR` to different credential directories before calling the
  same binary; `CLAUDE_ACCOUNTS` in `sdk/src/lib/claude-cli.ts` is the
  single source of truth, `GET /api/claude-cli-status` exposes both
  availability and the account list, the UI shows an account radio when
  more than one exists. Verified end-to-end: the two accounts hit genuinely
  separate credential state.
  - Gated two ways from ever reaching production: UI only shows it when
    `/api/claude-cli-status` reports available (probes `claude --version` +
    checks `NODE_ENV !== "production"`), and the route itself independently
    403s under `NODE_ENV === "production"` regardless of what the UI did.
  - **Known limitation, not fixable, documented, do not try to work around
    it again:** this account is under an organization with admin-configured
    Claude policy. That policy gets layered into *every* invocation under
    the account (interactive or `-p` one-shot) and explicitly overrides
    per-call `--system-prompt` instructions. On sensitive-sounding tasks
    (checking a possible phishing sender) the model can go fully free-form
    instead of returning the requested JSON, unpredictably, call to call.
    This is the org's governance working as intended. Do not suggest an
    OAuth-based alternative either — no such public mechanism exists for
    getting subscription-backed inference into a third-party app; the CLI
    subprocess bridge is the only real mechanism, not a stopgap.
  - Image input is not supported on the CLI backend yet (clear error, not
    silent failure).

**Token usage + streaming (added 2026-11-06).** Agent session now streams:
Plan/checks render the instant they're ready instead of waiting on the
Narrator too, and the Narrator's text streams in token-by-token for both
backends (CLI backend via `spawn` + `--output-format stream-json`, replacing
`execFile` which can't deliver incremental output). A one-line token/cost
summary now shows under results on both Quick check and Agent session — real
USD cost for the CLI backend (`--output-format json` exposes it), token
counts only for provider keys (no cost visible to this app). Full detail,
including a flagged-not-fixed finding about local `SessionStart` hooks
inflating CLI-backend token counts: `agents/diver/DECISIONS.md`.

## Gotchas hit and fixed (don't rediscover these)

1. **shadcn/ui here is on Base UI, not Radix.** `asChild` doesn't exist —
   use `render={<RealElement />}` instead, and set `nativeButton={false}`
   explicitly whenever the rendered element isn't a real `<button>` (e.g.
   `render={<Link>...</Link>}`), or you get a console warning.
2. **Next 16's "Cache Components" feature** changes static/dynamic
   inference. `export const runtime = "edge"` and `export const dynamic =
   "force-dynamic"` are both now rejected outright when `cacheComponents` is
   on (`next.config.ts`). To force a route to be genuinely dynamic (no
   request data touched, but needs live execution — e.g.
   `/api/claude-cli-status`), use `await connection()` from `"next/server"`
   instead. To silence a dynamism warning on a route that's actually fully
   static (e.g. `/agents/[agent]`, fully covered by `generateStaticParams`),
   use `export const instant = false`.
3. **Font CSS variable name must match what globals.css expects.** shadcn's
   generated `globals.css` has `--font-sans: var(--font-sans)` — the
   `next/font/google` loader's `variable` option must literally be named
   `--font-sans`, not something like `--font-geist-sans`, or the whole page
   silently falls back to the browser's serif default with no error.
4. **`execFile`/`execFileAsync` always opens a stdin pipe and never closes
   it.** `claude -p` sits waiting on it indefinitely. Fix: grab
   `execFileAsync(...).child` (exposed by `util.promisify`) and call
   `.stdin.end()` immediately.
5. **Node's default exec/execFile error message is useless** ("Command
   failed: <restated command>"). The real cause (`code`, `signal`,
   `killed`, `stdout`, `stderr`) are separate fields that get dropped
   unless you pull them out yourself — `describeExecFileError` in
   `claude-cli.ts` does this now, including detecting the specific
   "OAuth session expired" pattern and turning it into an actionable hint.
6. **Quoted-printable email bodies** (`Content-Transfer-Encoding:
   quoted-printable`, common in real Gmail exports) need byte-level
   decoding through a `Buffer`, not naive per-character `String.fromCharCode`
   — the latter mangles multi-byte UTF-8 sequences. Only the top-level
   header is handled; real multipart MIME (per-part encodings/boundaries)
   is not parsed — known gap.
7. **A huge `UsageLine` total on the Claude CLI backend (100k+ tokens) is
   normal, not a bug.** Each `claude -p` call loads Claude Code's own full
   environment first — full tool catalog, skills, slash commands, settings
   — before it even sees the actual prompt; that's almost all of what shows
   up as "cached" tokens, not anything this app added (confirmed: a
   trivial "say hi" test already showed ~23k tokens of fixed context after
   the caveman-hook fix). Anthropic bills/meters cached tokens at a steep
   discount vs. fresh ones, which is why a 200k-token total can correspond
   to ~2% of a subscription's usage window rather than looking proportional
   to the raw number. `UsageLine` (`diver-shared.tsx`) now has a collapsible
   breakdown explaining this inline. Full writeup: root `DECISIONS.md` →
   "Claude Code CLI subscription backend — componentized across all
   browser-wired agents".
8. **A workspace package's main entry is never safe to import from a
   `"use client"` file "just for one small thing."** Relocating Diver's
   `SAMPLE_EMAIL` fixture into the `diver` package and re-exporting it from
   `diver`'s main entry seemed like harmless de-duplication — but a client
   component importing from plain `"diver"` pulled in the *entire* package
   graph, including a `node:dns/promises` import three files deep
   (`checks/link-redirect.ts`), and Turbopack hard-panicked trying to
   bundle a Node builtin for the browser (`/agents/diver` 500'd). `tsc` and
   `eslint` both stayed green through this — only an actual page load
   caught it. Fix: add a narrow `exports` subpath (`"./fixtures"`) that
   pulls in nothing else, same pattern already used for `"./evals"`. Full
   writeup: root `DECISIONS.md` → "Eval runner — built (2026-11-10)".

9. **A Node-based tool's TLS fetch can fail even when `curl` to the same
   host works fine.** `pnpm add <new-package>` hung, looking identical to
   gotcha #7's pnpm-workspace-linking hang — but `--offline` doesn't help
   when installing a genuinely new external package. Real cause and fix:
   root `README.md` → "Running the project" → "Known install gotchas".

## What's next (original roadmap, in rough build order)

From the original 7-item roadmap, **all 7 are done** (provider key, chat
proxy, Diver's checklist logic, Inspector wiring, scaffold package content,
both toy agents, eval runner — now much more than originally scoped, see
above). The roadmap's original build order is complete; remaining work is
now the "other open items" below.

5. ~~**`scaffold` package**~~ — **content built 2026-11-09**, via a
   `/grilling` session closing the open questions from root `DECISIONS.md` →
   "Scaffold `.md` direction file format". Both flavors exist:
   `scaffold/typescript/` (grounded in `agents/diver/`'s real, proven
   plumbing — both LLM backends) and `scaffold/python/` (conceptual-only
   Google ADK conventions, honestly flagged as unvalidated — no real Python
   agent exists in this repo yet). Each is a tiny root `AGENTS.md` + `docs/`
   (progressive disclosure, Pocock-style) presenting a **menu of
   non-functional example directions**, not one working example:
   TypeScript gets `web-search-agent`, `joke-maker`, `document-mapper`;
   Python gets `image-reader`, `dataframe-analyst`,
   `iterative-refinement-agent`. Mechanism is pure prompt-paste for v1 (no
   code, no CLI) — shaped to not foreclose a thin invocation script or an
   ambient-convention mode later. Full rationale: root `DECISIONS.md` →
   "Scaffold package — built (2026-11-09)".
   **Still not built:** the deployed read-only scaffold-preview page
   (content-only this round, deliberately deferred — see that same
   `DECISIONS.md` section).
6. ~~**Eval runner**~~ — **built 2026-11-10**, deliberately *after* item 7
   specifically so the design got checked against two real,
   differently-shaped agents (Diver's structured exact-match output,
   `web-search-agent`'s free-text output) instead of just Diver. `/agents/
   [agent]/evals` is real for both: Diver's is server-run, keyless,
   exact-match against 4 hand-verified cases (`POST /api/evals/diver`,
   backed by `agents/diver/src/evals/`); `web-search-agent`'s is
   client-run against the user's chosen backend, substring-graded
   (`agents/web-search-agent/src/evals/`), reusing the exact same
   `/api/web-search-agent` route and SSE-parsing logic the live inspector
   uses (`sdk/src/lib/web-search-client.ts`) rather than a separate
   implementation. `image-reader` stays out of scope — Python/local-only,
   nothing here for it to plug into. Full rationale, including a real
   client-bundle regression caught before shipping: root `DECISIONS.md` →
   "Eval runner — built (2026-11-10)".
7. ~~**Toy agents**~~ — **built 2026-11-09.** `web-search-agent`
   (TypeScript) is a real multi-step tool-use loop using each provider's
   native web-search tool (`anthropic.tools.webSearch_*`,
   `google.tools.googleSearch`, `openai.tools.webSearch` — all three
   already present in the installed SDK versions), fully wired into `sdk`
   (streamed, live search-trace UI, reuses Diver's `UsageLine`/`CallUsage`).
   `image-reader` (Python) is a real, working standalone package —
   `google-genai` directly rather than `google-adk` (see
   `scaffold/python/docs/MODEL-BACKENDS.md` for why), verified against the
   live Gemini endpoint (real auth-error round-trip; no key available here
   to test actual vision output). `image-reader` is local-only by design —
   `sdk`'s agent page links to its README rather than embedding a live demo.
   **Side effect worth acting on:** `web-search-agent` solves the exact
   native-provider-search wiring that Diver's own deferred brand-allowlist
   fallback (below) has been blocked on — revisit that item with this as a
   reference.
   **Environment quirk hit while building this, not a code bug:** plain
   `pnpm install` hangs indefinitely in this sandbox the first time a new
   workspace package needs linking (reproduced independently three times,
   including outside any subagent). Fix and detail: root `README.md` →
   "Running the project" → "Known install gotchas".

Other open items, not yet started:
- **Harness UI/UX revamp, sharpened (2026-11-10): the real reference point is Google ADK's
  local Web UI — closer to it, not a clone of it.** User's own words: "I feel I have a
  documentation page still." Structural decisions from the original grilling session (shadcn/ui +
  Tailwind, routed pages not a sidebar SPA) are locked and not being revisited — this is about
  feel/interaction density, not architecture. Explicitly **not executed yet** — needs its own
  `/grilling` session first to pin down specifics (what "closer to ADK's Web UI" actually means
  page-by-page) before any real redesign work starts. A handful of small palliative tweaks landed
  2026-11-10 in the meantime (navbar acronym, homepage restructured toward a presentation/landing
  feel with feature cards, "Connect model key" moved out of the global nav into `ModelBackendPicker`
  where it's actually relevant, lucide-react icons added) — these do not replace the grilling
  session or the real revamp, explicitly called out as stopgaps only.
  **Follow-up, same day:** the homepage itself then got a real bold pass (not just a stopgap) —
  a 3-panel `DiagonalShowcase` with hover-speed-reactive `motion`-powered animations (circuit traces,
  a filling line graph, a typewriter effect), modeled directly on user-supplied reference images.
  Scoped to `/` only — the rest of the app (agent pages, evals, docs) still awaits the full revamp.
  Full writeup: root `DECISIONS.md` → "Homepage showcase — built (2026-11-10)".
  **Further iterated 2026-11-11/12:** the homepage header background (`DottedWaveBackground`,
  `sdk/src/components/home/dotted-wave-background.tsx`) went through many refinement passes —
  reshaped curve proportions (small-left/large-right humps), a static CSS 3D `perspective`/`rotateY`
  tilt (right edge closer to viewer), cursor-repulsion, a vertical fade, tighter/denser uniform
  parallel lines (~6000 `<circle>` DOM nodes total), and a fixed glassmorphism treatment applied to
  both the sticky navbar and the three `DiagonalShowcase` cards. A click-triggered "pulse" effect
  was tried and **dropped** — touching a large-enough subset of ~6000 real DOM nodes per frame to
  look good made it noticeably laggy, and this environment has no way to profile an actual browser
  to iterate on it blind.
  **Second, parallel WebGL implementation built 2026-11-12**
  (`sdk/src/components/home/dotted-wave-background-gl.tsx`), alongside the original SVG/DOM
  version — not replacing it. Shared geometry/color/tuning constants were pulled out of the
  original component into `sdk/src/components/home/dot-field.ts` so both read from one source of
  truth. The GL version uploads the ~6000 dots' positions/colors to static GPU buffers once, then
  draws them all in a single `gl.POINTS` draw call; cursor-repulsion physics (easing toward a
  mouse-driven target) still runs on the CPU every frame, over the same `Float32Array`s and the
  same ease constants as the DOM version — only the per-frame *render sink* changed, from ~6000
  individual `circle.style.transform` writes to one `bufferSubData` call. Cursor mapping reuses
  the same `getScreenCTM()` trick via a zero-child, `visibility: hidden` ghost `<svg>` rendered
  alongside the canvas, so the 3D-tilt coordinate math didn't need re-deriving. A small toggle
  button was added to the homepage (`sdk/src/app/page.tsx`, "Header: SVG/WebGL") to switch between
  the two at runtime for comparison; it defaults to the original SVG version, so production
  behavior is unchanged unless someone clicks it. Verified via `tsc`, `eslint`, `next build`, and a
  live SSR fetch (6068 `<circle>`s render under the default SVG state, no canvas in that markup,
  no new dev-server log errors) — **not** verified interactively in an actual browser (no browser
  automation available in this environment), so the WebGL path's visual output, point-size
  fidelity, and real frame-rate win are unconfirmed and worth the user actually opening the toggle
  to check. Known simplification: `gl_PointSize` is isotropic (a true circle) where the SVG
  version's non-uniform viewBox stretch makes dots slightly elliptical — judged not worth a
  per-axis correction at `r=1px`. Repulsion physics itself was deliberately *not* moved into the
  vertex shader (kept on the CPU, matching the DOM version) so the comparison isolates the one
  variable that actually mattered for the dropped pulse: DOM writes vs. one GPU buffer upload.
  **Pulse re-added to the GL version only, same day**, specifically to eval performance now that
  there's a GPU-buffer render sink: a click originates an outward ring (speed/duration/band-width
  tunable consts at the top of the file) that boosts point size, blends color toward white, and
  boosts alpha at the wavefront, self-cancelling after ~1.6s. Unlike the dropped DOM version, this
  is computed **entirely in the vertex/fragment shader** off three uniforms
  (`uPulseActive`/`uPulseOrigin`/`uPulseElapsed`) updated once per frame — zero added CPU cost per
  dot. User-reported result: "looks flawless" — confirms the DOM version's lagginess was the
  per-frame DOM writes, not the pulse math itself.
  **WebGL promoted to the only header, same day:** the toggle button is gone, the DOM/SVG version
  (`dotted-wave-background.tsx`) is no longer mounted anywhere — kept in the source, commented
  **deprecated**, for reference only. `/docs` got a new short "Homepage header" section stating
  this. A glassmorphism panel (`rounded-xl border bg-background/70 backdrop-blur-md`, same recipe
  as the navbar/cards) now wraps the hero title+subtitle, since it was hard to read directly over
  the moving lines.
  **Theming added, same day:** `next-themes` (new dependency), three themes — `light` (unchanged
  values), `dark` (already-existing `.dark` class in `globals.css`, now actually wired up —
  flips background/foreground contrast, was dead CSS before), and a new `matrix` theme (dark,
  green-hued UI chrome via oklch hue ~150). A navbar `ThemeToggle` (`sdk/src/components/
  theme-toggle.tsx`) cycles the three. Decorative "graphics" (header dots, circuit-animation
  traces/pulses, graph-fill-animation's wave/line/points) were switched from baked hex to four
  CSS custom properties (`--graphics-1..4`, `sdk/src/app/globals.css`) — identical hexes in
  `:root`/`.dark`, green shades in `.matrix` — so **only** decorative graphics recolor in matrix
  mode, not arbitrary UI elements. Plain CSS/SVG consumers (the two card animations) just
  reference `var(--graphics-N)` in `style`, no JS needed. The WebGL header is the one exception:
  its dot colors are baked into a GPU buffer at upload time, not re-read by the browser on
  repaint, so `dotted-wave-background-gl.tsx` resolves each CSS var via `getComputedStyle` once
  per unique color and re-uploads the color buffer whenever a `MutationObserver` sees the `<html>`
  class change (`next-themes`' mechanism for switching themes). Verified via `tsc`/`eslint`/
  `next build`/live SSR fetch (canvas present, zero `<circle>` dots, toggle/docs text present) —
  **not** interactively verified in a real browser (no browser automation here), so actually
  cycling all three themes and confirming the matrix graphics genuinely turn green is still on
  the user to check.
- **Brand allowlist's native-search fallback** — the `BrandLookup` hook
  exists in `agents/diver/src/checks/brand-allowlist.ts` but nothing
  implements it yet (would need to wire an actual Gemini/Claude/OpenAI
  native-search tool call when a claimed brand isn't in the local
  ~70-entry list).
- **Image input end-to-end test** — the vision path for Agent session
  (provider backend) has never actually been exercised with a real image
  and a real key; only the plumbing was built and typechecked.
- **Deployment** — nothing has been deployed to Vercel yet. All testing so
  far is against `pnpm --filter sdk dev` locally.
- Possible polish noticed during testing but not acted on: the homoglyph
  check doesn't currently flag a domain that's missing its real TLD
  (e.g. `redegazeta.com` vs. the real `redegazeta.com.br`) as suspicious —
  came up once in the Narrator's own commentary catching something the
  deterministic check didn't. Not filed as a decided fix, just an
  observation worth revisiting.

## How to pick this back up

Run instructions and install gotchas: root `README.md` → "Running the
project". Read root `DECISIONS.md` and `agents/diver/DECISIONS.md` in
full before making architectural changes — both are kept current and are
long (this file is the short version).
