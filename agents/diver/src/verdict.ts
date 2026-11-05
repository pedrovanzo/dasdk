import type { CheckResult, CheckStatus, Verdict } from "./types";

const STATUS_SEVERITY: Record<CheckStatus, number> = { fail: 3, warn: 2, unknown: 1, pass: 0 };

export function computeVerdict(checks: CheckResult[]): Verdict {
  if (checks.length === 0) return "yellow";
  const worst = Math.max(...checks.map((c) => STATUS_SEVERITY[c.status]));
  if (worst >= 3) return "red";
  if (worst >= 1) return "yellow";
  return "green";
}
