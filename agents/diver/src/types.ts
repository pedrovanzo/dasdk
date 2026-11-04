export type CheckStatus = "pass" | "warn" | "fail" | "unknown";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  evidence: string;
};

export type Verdict = "green" | "yellow" | "red";

export type DiverResult = {
  verdict: Verdict;
  checks: CheckResult[];
};

export type ParsedEmail = {
  /** Keys are lowercased header names; values preserve repeat order (e.g. multiple Authentication-Results). */
  headers: Map<string, string[]>;
  body: string;
};
