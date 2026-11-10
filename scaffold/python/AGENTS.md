# Python agent scaffold

Direction file for assembling a new Python/ADK-style agent under `agents/${NAME}/` in the dasdk monorepo.

**Runtime/package manager:** Python, single-package layout — one `pyproject.toml` at the agent's root, `uv` or `pip` for dependency management. This is a default suggestion, not a hard rule; there's no existing Python agent in this repo yet to enforce a convention, so adapt it if the spec calls for something else.

**Non-standard commands:** none. Standard `pyproject.toml` install/run flow applies.

## Further reading

- `docs/MODEL-BACKENDS.md` — how the agent talks to a model (ADK-style conventions)
- `docs/WORKSPACE.md` — where the agent lives and how it fits (or doesn't) into the rest of the repo
- `docs/DIRECTIONS.md` — a menu of example agent sketches to adapt or ignore

## Writing your spec

A spec for a new agent should probably mention:

- **Name** — kebab-case, becomes the `agents/${NAME}` folder name.
- **Purpose** — one line.
- **Closest sketch** — which of `docs/DIRECTIONS.md`'s three sketches it's closest to, or "none, fully custom."
- **Loop shape** — single-shot response, or a multi-step tool-use loop.
- **Model/backend** — which model or API backend it needs (see `docs/MODEL-BACKENDS.md`).
