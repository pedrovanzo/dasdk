import { runDiverChecklist } from "../index";
import { gradeDiverResult } from "./grader";
import { DIVER_EVAL_CASES, type DiverEvalCase } from "./cases";

export { DIVER_EVAL_CASES, type DiverEvalCase } from "./cases";
export { gradeDiverResult, type GradeResult } from "./grader";

export type EvalCaseResult = {
  id: string;
  description: string;
  pass: boolean;
  reasons: string[];
  latencyMs: number;
};

/** No model backend, no API key — Quick check's deterministic checklist needs neither, so neither does grading it. */
export async function runDiverEvals(): Promise<EvalCaseResult[]> {
  const results: EvalCaseResult[] = [];
  for (const testCase of DIVER_EVAL_CASES) {
    results.push(await runOne(testCase));
  }
  return results;
}

async function runOne(testCase: DiverEvalCase): Promise<EvalCaseResult> {
  const start = Date.now();
  const actual = await runDiverChecklist(testCase.rawEmail);
  const grade = gradeDiverResult(actual, testCase);
  return {
    id: testCase.id,
    description: testCase.description,
    pass: grade.pass,
    reasons: grade.reasons,
    latencyMs: Date.now() - start,
  };
}
