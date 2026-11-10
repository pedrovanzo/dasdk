import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Client-safe subpath: importing from "diver" directly would pull the whole package graph into the
// browser bundle, including checks/link-redirect.ts's node:dns/promises import.
export { SAMPLE_EMAIL } from "diver/fixtures";

export type CheckStatus = "pass" | "warn" | "fail" | "unknown";
export type CheckResult = { id: string; label: string; status: CheckStatus; evidence: string };
export type Verdict = "green" | "yellow" | "red";

export const VERDICT_STYLES: Record<Verdict, string> = {
  green: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  yellow: "border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-400",
  red: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  green: "Dived — looks legitimate",
  yellow: "Caution — some signals are off",
  red: "Spoofed — do not trust this",
};

const STATUS_BADGE_VARIANT: Record<CheckStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pass: "secondary",
  warn: "outline",
  fail: "destructive",
  unknown: "outline",
};

export function VerdictBanner({ verdict }: { verdict: Verdict }) {
  return (
    <div className={`rounded-lg border px-4 py-3 font-medium ${VERDICT_STYLES[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </div>
  );
}

export function CheckResultsList({ checks }: { checks: CheckResult[] }) {
  if (checks.length === 0) {
    return <p className="text-sm text-muted-foreground">No checks were run.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {checks.map((check) => (
        <div key={check.id} className="flex flex-col gap-1 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[check.status]}>{check.status}</Badge>
            <span className="font-medium">{check.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{check.evidence}</p>
        </div>
      ))}
    </div>
  );
}

export function Narration({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="rounded-md border bg-muted/30 p-3 text-sm">{text}</div>;
}

export type CallUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

function formatTokenCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** One-line token/cost summary for the model call(s) behind a result — CLI backend has real USD cost, provider backend only has token counts. */
export function UsageLine({ usage }: { usage: CallUsage | null | undefined }) {
  if (!usage || (usage.totalTokens === undefined && usage.costUsd === undefined)) return null;
  const parts: string[] = [];
  if (usage.totalTokens !== undefined) {
    parts.push(`${formatTokenCount(usage.totalTokens)} tokens`);
  }
  if (usage.costUsd !== undefined) {
    parts.push(`$${usage.costUsd < 0.01 ? usage.costUsd.toFixed(4) : usage.costUsd.toFixed(2)}`);
  }

  const hasBreakdown = usage.inputTokens !== undefined || usage.outputTokens !== undefined || Boolean(usage.cachedTokens);

  return (
    <div className="text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-2">
        <span>{parts.join(" · ")}</span>
        {hasBreakdown && (
          <Collapsible>
            <CollapsibleTrigger className="underline underline-offset-2 hover:text-foreground">
              breakdown
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 flex basis-full flex-col gap-1">
              <span>
                {usage.inputTokens !== undefined && `${formatTokenCount(usage.inputTokens)} in`}
                {usage.outputTokens !== undefined && ` / ${formatTokenCount(usage.outputTokens)} out`}
                {usage.cachedTokens ? ` / ${formatTokenCount(usage.cachedTokens)} cached` : ""}
              </span>
              {usage.cachedTokens ? (
                <span>
                  Cached tokens are mostly fixed overhead the Claude Code CLI backend loads on every
                  call (its own tool/skill catalog, not anything this app added) — Anthropic bills and
                  meters cached tokens at a steep discount vs. fresh ones, so a large total here barely
                  affects your actual subscription usage, even though the raw number looks alarming.
                </span>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
