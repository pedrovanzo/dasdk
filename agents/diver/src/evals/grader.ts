import type { DiverResult } from "../types";
import type { DiverEvalCase } from "./cases";

export type GradeResult = { pass: boolean; reasons: string[] };

/** Exact-match grader: Diver's output is deterministic, so no judge model is needed — a verdict or check status is either right or it isn't. */
export function gradeDiverResult(actual: DiverResult, testCase: DiverEvalCase): GradeResult {
  const reasons: string[] = [];

  if (actual.verdict !== testCase.expectedVerdict) {
    reasons.push(`verdict: expected "${testCase.expectedVerdict}", got "${actual.verdict}"`);
  }

  for (const [checkId, expectedStatus] of Object.entries(testCase.expectedChecks ?? {})) {
    const actualCheck = actual.checks.find((c) => c.id === checkId);
    if (!actualCheck) {
      reasons.push(`check "${checkId}": expected status "${expectedStatus}", but it did not run`);
    } else if (actualCheck.status !== expectedStatus) {
      reasons.push(`check "${checkId}": expected status "${expectedStatus}", got "${actualCheck.status}" (${actualCheck.evidence})`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}
