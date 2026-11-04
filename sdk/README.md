# sdk (agent SDK harness)

UI harness to run, inspect, and score agent performance — a publishable, browser-based alternative to Google ADK's local Web UI.

Next.js (App Router) + shadcn/ui + Tailwind. Routed pages per section (`/docs`, `/agents/[agent]`, etc.), no server-held API keys — visitors paste their own provider key at runtime.

Full decisions: [`../DECISIONS.md`](../DECISIONS.md).

## Dev

```bash
pnpm --filter sdk dev
```
