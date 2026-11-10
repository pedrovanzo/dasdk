export type WebSearchEvalCase = {
  id: string;
  description: string;
  question: string;
  /** Case-insensitive substring match — the answer passes if it contains at least one of these. Loose on purpose: model wording varies, a judge model is the more precise (and more expensive) upgrade path, not built for v1. */
  acceptableSubstrings: string[];
};

export const WEB_SEARCH_EVAL_CASES: WebSearchEvalCase[] = [
  {
    id: "capital-of-france",
    description: "Stable factual question, answerable with or without a real search.",
    question: "What is the capital of France?",
    acceptableSubstrings: ["paris"],
  },
  {
    id: "arithmetic",
    description: "Doesn't need a search at all — checks the agent still answers correctly when tool use isn't necessary.",
    question: "What is 7 times 8? Reply with just the number.",
    acceptableSubstrings: ["56"],
  },
  {
    id: "current-year",
    description: "Needs the model to actually be aware of (or search for) the current date rather than rely on training-data recall alone.",
    question: "What year is it right now?",
    acceptableSubstrings: ["2026"],
  },
];
