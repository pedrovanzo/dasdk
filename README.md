# dasdk

Monorepo for three portfolio/showcase demos built around AI agents. Prefix "d" = default demo-project prefix, "asdk" = agent software development kit.

Goal: publish as showcase (GitHub Pages / Vercel / similar).

## Layout

- `packages/sdk/` — agent SDK harness: UI to run/inspect/score agent performance, publishable alternative to Google's ADK Web.
- `packages/scaffold/` — agent scaffold tool: generator for new agent projects, conceptually like alura's `agents-cli`.
- `packages/agents/` — home for every agent (real or demo). First real agent: **Diver** (`packages/agents/diver/`), a sender/origin verification tool built with `sdk`/`scaffold`.

Key design constraint: self-provided API key. User pastes their own key at runtime; app never stores/registers a key. Shapes stack choices for all three packages (must support client-supplied credentials, no server-side secret storage).

Decisions captured via /grilling sessions — see individual package READMEs for current status.

## Reference material (not in this repo)

Alura course repo on Google ADK + Antigravity CLI ("Imersão Dev" immersion) lives at `../alura-google` (i.e. `misc-work/alura-google`, sibling of this folder) — kept out of `dasdk` on purpose so it never enters this public repo. Conceptual reference only, not reused as code. Contains a live API key in its `.env` (gitignored there) — never copy into `packages/`. Future agents: this is the full path, don't lose track of it.
