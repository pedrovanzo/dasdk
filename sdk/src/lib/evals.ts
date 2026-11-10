/** What a finished run produces for one case — emitted by the Diver route's batch response and by each step of web-search-agent's progressive client-side run. */
export type EvalCaseResult = {
  id: string;
  description: string;
  pass: boolean;
  reasons: string[];
  latencyMs: number;
};

/** What the results table renders — "idle"/"running" before and during a run, "pass"/"fail" once an EvalCaseResult comes in for that id. */
export type CaseStatus = "idle" | "running" | "pass" | "fail";

export type EvalCaseView = {
  id: string;
  description: string;
  status: CaseStatus;
  reasons?: string[];
  latencyMs?: number;
};
