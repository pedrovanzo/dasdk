# Diver

Agent that checks whether an email is real or a spoof/impersonation attempt (e.g. `staff@googIe.com`), by running a checklist of free, deterministic signals (homoglyph detection, SPF/DKIM/DMARC, reply-to mismatch, known-brand allowlist with a web-search fallback, safe link-redirect resolution) against the pasted raw email source, then narrating a traffic-light verdict.

dasdk's flagship real agent. Full decision log: [DECISIONS.md](./DECISIONS.md).

Status: wired into `sdk`'s Inspector with two modes — **Quick check** (deterministic-only, `runDiverChecklist(rawEmail)`) and **Agent session** (Planner → deterministic execution → Narrator, accepts text or image input, backed by a provider key or a dev-only Claude Code CLI bridge). See `DECISIONS.md` → "Agent session mode" for the architecture.

