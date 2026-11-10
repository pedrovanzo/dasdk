import type { WebSearchEvalCase } from "./cases";

export type GradeResult = { pass: boolean; reasons: string[] };

/** Substring grader (v1 scope, per the project's own eval-runner decision): free-text output, so exact-match isn't possible — a judge model would be more precise but costs a second model call per case, deferred. */
export function gradeWebSearchAnswer(answerText: string, testCase: WebSearchEvalCase): GradeResult {
  const lower = answerText.toLowerCase();
  const matched = testCase.acceptableSubstrings.some((s) => lower.includes(s.toLowerCase()));
  if (matched) return { pass: true, reasons: [] };
  return {
    pass: false,
    reasons: [`answer did not contain any of: ${testCase.acceptableSubstrings.map((s) => `"${s}"`).join(", ")}`],
  };
}
