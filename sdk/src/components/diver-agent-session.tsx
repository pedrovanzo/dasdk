"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModelBackend } from "@/lib/use-model-backend";
import { ModelBackendPicker } from "@/components/model-backend-picker";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import {
  VerdictBanner,
  CheckResultsList,
  Narration,
  UsageLine,
  type Verdict,
  type CheckResult,
  type CallUsage,
} from "@/components/diver-shared";

type Plan = { extracted: Record<string, unknown>; checksToRun: string[]; reasoning: string };
type SessionResult = { plan: Plan; verdict: Verdict; checks: CheckResult[] };

export function DiverAgentSession() {
  const model = useModelBackend();
  const [inputKind, setInputKind] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [narration, setNarration] = useState<string | null>(null);
  const [usage, setUsage] = useState<CallUsage | undefined>(undefined);

  const hasInput = inputKind === "text" ? text.trim().length > 0 : imageDataUrl !== null;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageDataUrl(await fileToDataUrl(file));
  }

  async function handleRun() {
    if (!hasInput || !model.backendReady || !model.backend) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setNarration(null);
    setUsage(undefined);
    try {
      const input =
        inputKind === "text" ? { kind: "text" as const, text } : { kind: "image" as const, dataUrl: imageDataUrl! };

      const res = await fetch("/api/diver/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, backend: model.backend }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error("No response stream.");

      setNarrating(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let narrationSoFar = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "result"; plan: Plan; verdict: Verdict; checks: CheckResult[] }
            | { type: "narration-delta"; text: string }
            | { type: "done"; usage?: CallUsage };
          if (event.type === "result") {
            setResult({ plan: event.plan, verdict: event.verdict, checks: event.checks });
          } else if (event.type === "narration-delta") {
            narrationSoFar += event.text;
            setNarration(narrationSoFar);
          } else if (event.type === "done") {
            setUsage(event.usage);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setNarrating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent session</CardTitle>
          <CardDescription>
            Give Diver a bare address, a URL, short text, or a screenshot — it decides which checks
            apply, then runs them the same deterministic way as Quick check.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Collapsible>
            <CollapsibleTrigger className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              How is this different from Quick check?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
              A planning step reads your input first and picks only the checks that have enough data
              to run — e.g. a bare address skips the header-based checks entirely. That plan is shown
              below before the results. Needs a connected model (for planning and the final summary);
              the checks themselves are still deterministic and never overridden.
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2">
            <Button
              nativeButton
              size="sm"
              variant={inputKind === "text" ? "default" : "outline"}
              onClick={() => setInputKind("text")}
            >
              Text
            </Button>
            <Button
              nativeButton
              size="sm"
              variant={inputKind === "image" ? "default" : "outline"}
              onClick={() => setInputKind("image")}
            >
              Image
            </Button>
          </div>

          {inputKind === "text" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an email address, a URL, or full raw email source..."
              rows={6}
              className="font-mono text-xs"
            />
          ) : (
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
          )}

          <ModelBackendPicker model={model} />

          {inputKind === "image" && model.effectiveBackend === "claude-cli" && (
            <p className="text-xs text-muted-foreground">
              Using your local Claude Code session — since one-shot CLI calls can&apos;t carry image
              bytes directly, your image is written to a temp file and read via Claude&apos;s own Read
              tool (scoped to that one file only), then deleted. Expect a bit more latency than a
              direct provider-key call.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton onClick={handleRun} disabled={loading || !hasInput || !model.backendReady}>
              {loading ? "Running..." : "Run agent session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">{result.plan.reasoning}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.plan.checksToRun.map((id) => (
                  <Badge key={id} variant="secondary">
                    {id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <VerdictBanner verdict={result.verdict} />
          <CheckResultsList checks={result.checks} />
          {narrating && !narration && <p className="text-sm text-muted-foreground">Narrating...</p>}
          <Narration text={narration} />
          <UsageLine usage={usage} />
        </div>
      )}
    </div>
  );
}
