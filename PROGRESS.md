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

## What's next (original roadmap, in rough build order)

From the original 7-item roadmap, **1–4 are done** (provider key, chat
proxy, Diver's checklist logic, Inspector wiring — now much more than
originally scoped, see above). Remaining:

5. **`scaffold` package** — not started beyond a README. Decided shape
   (see root `DECISIONS.md` → "Scaffold `.md` direction file format"):
   Matt Pocock–style minimal `AGENTS.md` + progressive-disclosure `docs/`
   folder, NOT the fuller Alura/ADK-style upfront brief. Two flavors
   (Python, TypeScript). Scaffold generation is explicitly **local-only
   forever** — the deployed app only shows a dummy/read-only preview of the
   concept, never actually generates files.
6. **Eval runner** — not started. Decided shape: per-agent graders (not
   centralized), test cases co-located with each agent (e.g.
   `agents/diver/evals/`), `sdk`'s harness is a generic runner that
   discovers whatever `evals/` folder exists per agent. The
   `/agents/[agent]/evals` page currently just shows a placeholder string.
7. **Toy agents** — `web-search-agent` (TypeScript, Pocock-style,
   web-search tool) and `image-reader` (Python, vision-based) are each
   just a README right now, no code. Needed to actually prove out both
   scaffold flavors and to populate the harness demo with more than one
   real example.

Other open items, not yet started:
- **Harness UI/UX visual polish** — explicitly deferred since the original
  grilling session; structural decisions (shadcn/ui + Tailwind, routed
  pages not sidebar) are locked, but color/density/layout specifics are not.
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

```bash
cd dasdk
pnpm install
pnpm --filter sdk dev
```

Open `http://localhost:3000`. `/agents/diver` is the only fully working
agent page. Read root `DECISIONS.md` and `agents/diver/DECISIONS.md` in
full before making architectural changes — both are kept current and are
long (this file is the short version).
