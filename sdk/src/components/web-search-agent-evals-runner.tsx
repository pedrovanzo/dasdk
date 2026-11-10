"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModelBackendPicker } from "@/components/model-backend-picker";
import { EvalResultsTable } from "@/components/eval-results-table";
import { useModelBackend } from "@/lib/use-model-backend";
import { askWebSearchAgent, extractAnswerText } from "@/lib/web-search-client";
import { WEB_SEARCH_EVAL_CASES, gradeWebSearchAnswer } from "web-search-agent/evals";
import type { EvalCaseView } from "@/lib/evals";

const INITIAL_CASES: EvalCaseView[] = WEB_SEARCH_EVAL_CASES.map((c) => ({
  id: c.id,
  description: c.description,
  status: "idle",
}));

export function WebSearchAgentEvalsRunner() {
  const model = useModelBackend();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<EvalCaseView[]>(INITIAL_CASES);

  function updateCase(id: string, patch: Partial<EvalCaseView>) {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleRun() {
    if (!model.backendReady || !model.backend) return;
    setLoading(true);
    setError(null);
    setCases(INITIAL_CASES.map((c) => ({ ...c, status: "idle", reasons: undefined, latencyMs: undefined })));
    const backend = model.backend;
    try {
      for (const testCase of WEB_SEARCH_EVAL_CASES) {
        updateCase(testCase.id, { status: "running" });
        const start = Date.now();
        let errorText: string | null = null;
        const message = await askWebSearchAgent(backend, testCase.question, {
          onError: (err) => {
            errorText = err instanceof Error ? err.message : "Model call failed.";
          },
        });
        const latencyMs = Date.now() - start;
        if (errorText || !message) {
          updateCase(testCase.id, { status: "fail", reasons: [errorText ?? "No response received."], latencyMs });
          continue;
        }
        const grade = gradeWebSearchAnswer(extractAnswerText(message), testCase);
        updateCase(testCase.id, { status: grade.pass ? "pass" : "fail", reasons: grade.reasons, latencyMs });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setError(null);
    setCases(INITIAL_CASES);
  }

  const hasRunResults = cases.some((c) => c.status !== "idle");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Runs each question through the real agent (your choice of backend below) and grades the final
        answer by substring match — loose on purpose, since free-text wording varies call to call. Runs
        cases one at a time, live — watch each one go from &ldquo;running…&rdquo; to pass/fail below as
        it finishes, rather than waiting for all of them at once.
      </p>
      <ModelBackendPicker model={model} />
      <div className="flex flex-wrap items-center gap-2">
        <Button nativeButton onClick={handleRun} disabled={loading || !model.backendReady}>
          {loading ? "Running..." : "Run evals"}
        </Button>
        <Button nativeButton variant="outline" onClick={handleClear} disabled={loading || !hasRunResults}>
          Clear results
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <EvalResultsTable cases={cases} />
    </div>
  );
}
