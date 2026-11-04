# Diver

Agent that checks whether an email is real or a spoof/impersonation attempt (e.g. `staff@googIe.com`), by running a checklist of free, deterministic signals (homoglyph detection, SPF/DKIM/DMARC, reply-to mismatch, known-brand allowlist with a web-search fallback, safe link-redirect resolution) against the pasted raw email source, then narrating a traffic-light verdict.

dasdk's flagship real agent. Full decision log: [DECISIONS.md](./DECISIONS.md).

Status: defined, not yet built.
