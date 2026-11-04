import type { CheckResult, CheckStatus } from "../types.js";

type Mechanism = "spf" | "dkim" | "dmarc";

function parseMechanismResult(headerValues: string[], mechanism: Mechanism): string | null {
  const re = new RegExp(`${mechanism}=([a-zA-Z]+)`, "i");
  for (const value of headerValues) {
    const match = value.match(re);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function classify(result: string | null): CheckStatus {
  if (result === null) return "unknown";
  if (result === "pass") return "pass";
  if (["softfail", "neutral", "none"].includes(result)) return "warn";
  return "fail"; // fail, permerror, temperror, policy, etc.
}

const STATUS_SEVERITY: Record<CheckStatus, number> = { fail: 3, warn: 2, unknown: 1, pass: 0 };

export function checkAuthResults(authResultsHeaders: string[]): CheckResult {
  if (authResultsHeaders.length === 0) {
    return {
      id: "auth-results",
      label: "SPF / DKIM / DMARC verification",
      status: "unknown",
      evidence:
        "No Authentication-Results header found in the pasted source — this webmail export may not include it, or the message was never authenticated.",
    };
  }

  const spf = parseMechanismResult(authResultsHeaders, "spf");
  const dkim = parseMechanismResult(authResultsHeaders, "dkim");
  const dmarc = parseMechanismResult(authResultsHeaders, "dmarc");

  const entries: Array<[Mechanism, string | null]> = [
    ["spf", spf],
    ["dkim", dkim],
    ["dmarc", dmarc],
  ];

  const statuses = entries.map(([, result]) => classify(result));
  const worst = statuses.reduce((a, b) => (STATUS_SEVERITY[b] > STATUS_SEVERITY[a] ? b : a), "pass" as CheckStatus);

  const summary = entries.map(([mechanism, result]) => `${mechanism}=${result ?? "missing"}`).join(", ");

  return {
    id: "auth-results",
    label: "SPF / DKIM / DMARC verification",
    status: worst,
    evidence: `Authentication-Results: ${summary}.`,
  };
}
