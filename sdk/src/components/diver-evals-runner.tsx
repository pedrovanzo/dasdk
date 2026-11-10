"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EvalResultsTable } from "@/components/eval-results-table";
import type { EvalCaseView, EvalCaseResult } from "@/lib/evals";
import { DIVER_EVAL_CASES } from "diver/evals/cases";

const INITIAL_CASES: EvalCaseView[] = DIVER_EVAL_CASES.map((c) => ({
  id: c.id,
  description: c.description,
  status: "idle",
}));

export function DiverEvalsRunner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<EvalCaseView[]>(INITIAL_CASES);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setCases((prev) => prev.map((c) => ({ ...c, status: "running", reasons: undefined, latencyMs: undefined })));
    try {
      const res = await fetch("/api/evals/diver", { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = (await res.json()) as { results: EvalCaseResult[] };
      const byId = new Map(body.results.map((r) => [r.id, r]));
      setCases((prev) =>
        prev.map((c) => {
          const result = byId.get(c.id);
          if (!result) return c;
          return { ...c, status: result.pass ? "pass" : "fail", reasons: result.reasons, latencyMs: result.latencyMs };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCases((prev) => prev.map((c) => ({ ...c, status: "idle" })));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setError(null);
    setCases(INITIAL_CASES);
  }

  const hasRunResults = cases.some((c) => c.status === "pass" || c.status === "fail");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Grades Quick check&apos;s deterministic checklist against a fixed set of raw emails with known
        expected verdicts/check statuses — exact-match, no model or API key needed.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button nativeButton onClick={handleRun} disabled={loading}>
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
