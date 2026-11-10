# scaffold

Static `.md` direction files for building a new agent under `agents/${NAME}/` — not a CLI, not a web generator, not code. Pair a flavor's folder with your own spec (see each flavor's `AGENTS.md` for what a spec should cover) and hand both to a coding agent to assemble the real files. Generation is local-only, always — the deployed app never runs this.

Each flavor is a menu of non-functional example directions, not one working example to copy. Pick one, adapt it, or write a fully custom spec.

- **`typescript/`** — Vercel AI SDK stack, modeled on `agents/diver/`'s proven plumbing (both LLM backends: provider key and the local Claude Code CLI dev-bridge). Menu: `web-search-agent`, `joke-maker`, `document-mapper`.
- **`python/`** — Google ADK-style conventions, conceptual only (no real Python agent exists in this repo yet to ground it in). Menu: `image-reader`, `dataframe-analyst`, `iterative-refinement-agent`.

Full rationale and decision history: root [`DECISIONS.md`](../DECISIONS.md) → "Scaffold package" sections.

Not yet built: a read-only preview of this content on the deployed site (flagged in `DECISIONS.md`'s deployment model, deferred alongside harness UI polish).
