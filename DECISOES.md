# Decisions log

Captured from a /grilling session (2026-10-30/31). Source of truth for the shape of this monorepo; update as decisions change.

## Scope

Three packages, one monorepo:

- **`packages/sdk`** — agent SDK harness. Publishable, browser-based alternative to Google ADK's local Web UI. Ships both an interactive inspector (live chat, tool-call/skill-load/gating event log) and an eval runner (test cases, pass/fail, latency/cost, cross-provider comparison).
- **`packages/scaffold`** — not a CLI, not a web generator. Static `.md` direction file(s) describing how an agent should behave. An LLM reads the directions plus a spec (session prompt or `.md` from an existing project) and assembles real files into `packages/agents/${NEW_AGENT_NAME}`. Two flavors: Python (ADK-style, modeled on the Alura reference) and TypeScript (Vercel AI SDK style, modeled on a Matt Pocock web-search-agent pattern). Initial scaffold content is intentionally shallow.
- **`packages/agents/`** — home for every agent, real or demo/toy, one subfolder each (convention: "agents live in `packages/agents/`" — chosen over naming the folder after each agent, which would be easy to forget). First real agent is **Diver** (`packages/agents/diver/`) — sender/origin verification against known-brand sources (see its own [DECISOES.md](./packages/agents/diver/DECISOES.md)). Two toy agents join it, one per scaffold flavor: **`web-search-agent`** (TypeScript, Pocock-style) and **`image-reader`** (Python, vision-based text extraction/description). More agents may follow later — not committed to a fixed count or direction.

## Deployment model

- **100% real usage is local.** Scaffold generation only ever happens when someone clones the repo and runs it themselves — the deployed app never writes agent files back into the repo (Vercel's filesystem can't durably support that anyway).
- The **deployed app** (Vercel, Next.js App Router) is a showcase layer only:
  - docs area explaining the three-part ecosystem
  - a dummy/read-only scaffold preview (shows the under-the-hood idea, doesn't generate anything)
  - the `sdk` harness with pre-built agents visitors can actually run
- **No server-held API keys, ever.** Visitors paste their own provider key at runtime (Q3, Q16). "Free alternative" (e.g. `gemini-flash-latest`) means "this provider has a fast free signup," not "we proxy it for you" — keeps the public demo lean and free of quota/billing/abuse exposure.
- **Local-dev-only extra mode:** the harness can also shell out to the `claude` CLI (`claude -p <prompt>`) to ride the developer's own logged-in Claude Code session instead of an API key — confirmed working pattern, found in `~/Desktop/prompt-eval/run_eval.py`. Never offered to public visitors; flagged as a possibility in the docs page only.
- GitHub Pages was ruled out — the harness needs a thin serverless function per request (proxying whatever key the visitor typed, never persisting it) for things like tool execution, which static-only Pages can't run.

## Stack

- **Framework:** Next.js (App Router) for all packages with a UI — pairs natively with Vercel AI SDK's React hooks and Vercel's deploy model.
- **Agent runtime:** Vercel AI SDK (TypeScript), not Google ADK or LangChain.js — thin and unopinionated, since `sdk`/`scaffold` are themselves building the skills/gating/tool abstraction layer rather than inheriting one.
- **Providers:** multi-provider from day one. v1 supports exactly **Gemini, Anthropic, OpenAI** — covers Diver's native-search requirement completely and keeps the provider-selector simple. An aggregator option (e.g. OpenRouter) was considered and rejected for v1 (different auth/pricing semantics, marginal benefit); **later SaaS versions will need many more providers**, noted as a deliberate v1-only restriction, not a permanent one.
- **Monorepo tooling:** pnpm workspaces, no Turborepo for now — three sibling packages with no real build-dependency chain yet.
- **License:** MIT. **Repo:** public, under GitHub account `pedrovanzo`.
- **Component library:** shadcn/ui + Tailwind — the pairing Vercel AI SDK's own docs/examples are built around, so streaming-chat and tool-call-log UI patterns are already solved; design effort goes toward the genuinely novel parts (Diver's verdict breakdown, eval comparison view).
- **Navigation:** separate routed pages per section (`/docs`, `/agents/diver`, `/agents/diver/evals`, etc.), not a single-page sidebar shell — chosen for finer control over each page's layout, with shared UI kept well-componentized underneath to avoid duplication.
- **Public product name:** the deployed site uses **"dasdk"** itself, no separate consumer-facing brand — the docs page's first section carries the job of explaining the name, avoiding a second name to maintain.

## Reference material

- `misc-work/alura-google` (sibling of this folder, **not** inside it, **not** part of this repo) — the Alura "Imersão Dev" course repo on Google ADK + Antigravity CLI. Conceptual reference only (ADK skills system, progressive disclosure, `EnvironmentToolset`, gating logic), never reused as code. Contains a live API key in its own `.env` (gitignored there) — never copy it anywhere near `packages/`. Moved out of `dasdk` specifically so it can't end up in the public repo by accident.
- Matt Pocock web-search-agent short (TypeScript/Vercel AI SDK pattern): https://www.youtube.com/shorts/uNkv2t6c40o — exact source snippet not published; closest found equivalent is Vercel AI SDK's own Tavily cookbook (`stopWhen: isStepCount(n)` replacing the older `maxSteps`).
- Docs page (inside `packages/sdk`) credits the Alura/Google immersion and briefly covers both the all-Google stack (Antigravity CLI, ADK, Vertex/AI Studio, Cloud Shell/Cloud Run) and this project's mixed stack (Next.js, Vercel, Vercel AI SDK, git/GitHub, multi-provider keys) — comprehensive but not a deep comparison.

## Scaffold `.md` direction file format

Adopted **Matt Pocock's AGENTS.md style** (minimal, progressive-disclosure), explicitly chosen over the Alura/ADK style (fuller upfront Goal/Context/Constraints/Done-when brief) — matches the workflow the user had already built their own process around before this project existed.

- **Root file stays tiny**: one-sentence agent purpose, runtime/package manager, only non-standard commands. No redundant instructions, no obvious guidance, nothing the assembling LLM can derive itself.
- **Everything else lives in a `docs/` folder** referenced with light-touch links from the root file (e.g. `docs/TOOLS.md`, `docs/BEHAVIOR.md`), loaded by the assembling LLM only as needed — same progressive-disclosure *concept* as ADK skills' L1/L2/L3, implemented as plain files instead of a skill-loader mechanism.
- Applies to both scaffold flavors (Python and TypeScript).

## Eval runner

- **Grading is per-agent, not centralized.** Each agent in `packages/agents/*` owns its own grader: Diver's structured traffic-light output can be graded by exact match (no judge LLM needed, cheaper and deterministic); free-text agents (`web-search-agent`, `image-reader`) use substring checks or model-as-judge as appropriate to their output shape. Rejected a single global grading strategy (exact-match-only is unusable for free text; model-as-judge-only adds unnecessary non-determinism/cost to Diver's already-deterministic output).
- **Test cases + graders are co-located with each agent** (e.g. `packages/agents/diver/evals/`), not centralized in `packages/sdk`. The harness (`sdk`) is a generic runner that discovers and executes whatever `evals/` folder it finds per agent — adding a new agent later never requires touching `sdk`.

## Docs page (`/docs`) outline

Six sections, locked as the full structure (not a starting draft):

1. **What this is** — ecosystem overview (sdk + scaffold + agents), portfolio/showcase framing, and where the name "dasdk" comes from.
2. **Concepts** — what "agent," "skill," "tool," "eval" mean here, written for someone new to agent frameworks.
3. **How scaffold works** — the `.md`-direction-file approach (Pocock-style progressive disclosure), with a note that the deployed preview is dummy/read-only and real generation is local-only.
4. **The agents** — Diver (including the "Dived" vocabulary), `web-search-agent`, `image-reader` — what each demos.
5. **Stack notes** — brief, named-not-deep-dived mentions of the all-Google stack (Antigravity CLI, ADK, Vertex/AI Studio, Cloud Shell/Cloud Run) vs. this mixed stack (Next.js, Vercel, Vercel AI SDK, git/GitHub, multi-provider keys).
6. **Credits** — the Alura/Google immersion course, and Matt Pocock/AI Hero (AGENTS.md pattern, web-search-agent inspiration).

## Open / deferred

- Harness UI/UX visual details (color palette, density, exact component layout within each page) — flagged as needing special design attention; structural decisions (component library, routing) are locked above, remaining specifics deferred to build time.
- Whether more demo agents get added later, and in what shape — intentionally left open, cheap to change.
- A batch image-resizer agent (nod to an old college project handling a thesis image gallery) was considered as a third toy agent alongside `web-search-agent` and `image-reader`, then **dropped entirely** — it needed real local filesystem access (batch-processing a gallery), which doesn't fit the stateless/browser-upload model the deployed harness uses, and the user judged it too much scope for the demo relative to its payoff.
