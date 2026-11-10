# Workspace conventions

A new TypeScript agent lives under `agents/${NAME}/` (kebab-case name), a sibling of `agents/diver/`.

It's its own pnpm workspace package — `pnpm-workspace.yaml` at the repo root already globs `agents/*`, so dropping a `package.json` in the new folder is enough to join the workspace. Mirror `agents/diver/package.json`: `"private": true`, `"type": "module"`, a `typecheck` script (`tsc --noEmit`), `typescript` + `@types/node` as devDependencies, plus whatever the agent actually needs (`ai`, `zod`, provider SDKs).

Wiring into `sdk` is currently manual, not automatic. Today:
- `sdk/src/lib/agents.ts` holds a static `AgentDefinition[]` array (slug, name, tagline, description) — add an entry here to make the agent show up on `/agents` and get a route at `/agents/${slug}`.
- `sdk/src/app/agents/[agent]/page.tsx` renders that route; `generateStaticParams` comes straight from the `agents` array. Right now it special-cases `agent.slug === "diver"` to render `<DiverInspector />` — any other slug falls back to a disabled "not wired up yet" placeholder. Hooking up a real inspector UI for a new agent means adding a similar case (or a less hardcoded dispatch) here.

That's the whole mechanism today — there's no agent-discovery or plugin system, just this array and the one conditional.
