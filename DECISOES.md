# Decisions log

Captured from a /grilling session (2026-10-30/31). Source of truth for the shape of this monorepo; update as decisions change.

## Scope

Three packages, one monorepo:

- **`packages/sdk`** — agent SDK harness. Publishable, browser-based alternative to Google ADK's local Web UI. Ships both an interactive inspector (live chat, tool-call/skill-load/gating event log) and an eval runner (test cases, pass/fail, latency/cost, cross-provider comparison).
- **`packages/scaffold`** — not a CLI, not a web generator. Static `.md` direction file(s) describing how an agent should behave. An LLM reads the directions plus a spec (session prompt or `.md` from an existing project) and assembles real files into `packages/agent/${NEW_AGENT_NAME}`. Two flavors: Python (ADK-style, modeled on the Alura reference) and TypeScript (Vercel AI SDK style, modeled on a Matt Pocock web-search-agent pattern). Initial scaffold content is intentionally shallow.
- **`packages/agent`** — the first real, goal-driven agent (goal TBD), plus a couple of trivial example agents whose only job is to populate the deployed demo. This may grow into more agents later — not committed to a fixed count or direction.

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
- **Providers:** multi-provider from day one (Gemini, OpenAI, Anthropic, ...) — the harness's whole pitch is comparing agents, so locking to one provider undercuts it.
- **Monorepo tooling:** pnpm workspaces, no Turborepo for now — three sibling packages with no real build-dependency chain yet.
- **License:** MIT. **Repo:** public, under GitHub account `pedrovanzo`.

## Reference material

- `misc-work/alura-google` (sibling of this folder, **not** inside it, **not** part of this repo) — the Alura "Imersão Dev" course repo on Google ADK + Antigravity CLI. Conceptual reference only (ADK skills system, progressive disclosure, `EnvironmentToolset`, gating logic), never reused as code. Contains a live API key in its own `.env` (gitignored there) — never copy it anywhere near `packages/`. Moved out of `dasdk` specifically so it can't end up in the public repo by accident.
- Matt Pocock web-search-agent short (TypeScript/Vercel AI SDK pattern): https://www.youtube.com/shorts/uNkv2t6c40o — exact source snippet not published; closest found equivalent is Vercel AI SDK's own Tavily cookbook (`stopWhen: isStepCount(n)` replacing the older `maxSteps`).
- Docs page (inside `packages/sdk`) credits the Alura/Google immersion and briefly covers both the all-Google stack (Antigravity CLI, ADK, Vertex/AI Studio, Cloud Shell/Cloud Run) and this project's mixed stack (Next.js, Vercel, Vercel AI SDK, git/GitHub, multi-provider keys) — comprehensive but not a deep comparison.

## Open / deferred

- Concrete goal/domain for the first real agent in `packages/agent` — not yet chosen.
- Harness UI/UX — flagged as needing special design attention (lots of complex concepts, needs to stay simple/friendly); specifics deferred to build time.
- Whether more demo agents get added later, and in what shape — intentionally left open, cheap to change.
