# Workspace conventions

A new Python agent lives under `agents/${NAME}/` (kebab-case name), sibling of `agents/diver/`.

It is its own standalone Python project — own `pyproject.toml`, own virtualenv. It is explicitly **not** part of the pnpm workspace; pnpm workspaces are a TypeScript/JS-only mechanism and don't apply to a Python package.

## The routing gap

`sdk` is a Next.js/TypeScript app. A TypeScript agent can be wired into its routing/registry directly; a Python agent can't be, the same way, automatically. Running or exposing a Python agent alongside `sdk` would need either a small HTTP wrapper around it or some other out-of-band invocation (CLI script, separate process, whatever fits).

This gap isn't solved here — it's just named so it isn't discovered by surprise later.
