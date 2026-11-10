# TypeScript agent scaffold

Direction files for building a new agent under `agents/${NAME}/` in the dasdk monorepo. Not code, not a generator — paste this folder plus your spec into a coding agent and have it build the thing.

Runtime: Node.js + TypeScript, pnpm workspaces. Model calls go through the Vercel AI SDK `ai` package; structured extraction uses Zod. No non-standard commands — standard `pnpm install` / `pnpm --filter ${name} typecheck` etc.

Docs (load only as needed):
- `docs/MODEL-BACKENDS.md` — how a TS agent here talks to a model (provider key vs. local Claude CLI bridge).
- `docs/WORKSPACE.md` — where the new package lives and how it's wired into `sdk`.
- `docs/DIRECTIONS.md` — three example agent pitches to adapt or ignore.

## Writing your spec

Before building, a spec for the new agent should probably cover:
- **Name** — kebab-case, becomes the `agents/${NAME}` folder name.
- **Purpose** — one line.
- **Closest direction** — which sketch in `docs/DIRECTIONS.md` it resembles, or "none, fully custom."
- **Shape** — a multi-step tool-use loop, or single-shot extract-then-generate.
- **Backend(s)** — provider API key, local Claude CLI bridge, or both.
