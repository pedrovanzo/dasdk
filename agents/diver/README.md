# Diver

Agent that checks whether an email is real or a spoof/impersonation attempt (e.g. `staff@googIe.com`), by running a checklist of free, deterministic signals (homoglyph detection, SPF/DKIM/DMARC, reply-to mismatch, known-brand allowlist with a web-search fallback, safe link-redirect resolution) against the pasted raw email source, then narrating a traffic-light verdict.

dasdk's flagship real agent. Full decision log: [DECISIONS.md](./DECISIONS.md).

Status: checklist logic built (`src/`) — all five checks implemented and smoke-tested (homoglyph/typosquat, SPF/DKIM/DMARC, reply-to mismatch, brand allowlist with pluggable web-search fallback, SSRF-guarded link-redirect resolution). Not yet wired into the `sdk` Inspector UI — `runDiverChecklist(rawEmail)` is the entry point.

