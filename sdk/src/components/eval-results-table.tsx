import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CaseStatus, EvalCaseView } from "@/lib/evals";

const STATUS_BADGE: Record<CaseStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  idle: { variant: "outline", label: "not run yet" },
  running: { variant: "outline", label: "running…" },
  pass: { variant: "secondary", label: "pass" },
  fail: { variant: "destructive", label: "fail" },
};

function SummaryLine({ cases }: { cases: EvalCaseView[] }) {
  const finished = cases.filter((c) => c.status === "pass" || c.status === "fail");
  const passCount = cases.filter((c) => c.status === "pass").length;

  if (finished.length === 0) {
    return <p className="text-sm text-muted-foreground">{cases.length} case{cases.length === 1 ? "" : "s"} ready to run.</p>;
  }
  if (finished.length < cases.length) {
    return (
      <p className="text-sm font-medium">
        {finished.length}/{cases.length} finished so far — {passCount} passed
      </p>
    );
  }
  return (
    <p className="text-sm font-medium">
      {passCount}/{cases.length} passed
    </p>
  );
}

/** One row per case, always visible (even before a run), so it's clear up front what's about to be tested — not just a black box that eventually produces a verdict. Description/failure reasons are behind a collapsible "details" trigger, not hidden entirely. */
export function EvalResultsTable({ cases }: { cases: EvalCaseView[] }) {
  if (cases.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <SummaryLine cases={cases} />
      <div className="flex flex-col gap-2">
        {cases.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
              <span className="font-medium">{c.id}</span>
              {c.latencyMs !== undefined && <span className="text-xs text-muted-foreground">{c.latencyMs}ms</span>}
            </div>
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                details
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{c.description}</p>
                {c.status === "fail" && c.reasons && c.reasons.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pl-4 text-xs text-destructive">
                    {c.reasons.map((reason, i) => (
                      <li key={i} className="list-disc">
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}
      </div>
    </div>
  );
}
