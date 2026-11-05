"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useApiKey } from "@/lib/use-api-key";
import { DEFAULT_MODELS } from "@/lib/providers";
import { VerdictBanner, CheckResultsList, Narration, type Verdict, type CheckResult } from "@/components/diver-shared";

const CLAUDE_CLI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CLAUDE_CLI_BACKEND === "true";

type Plan = { extracted: Record<string, unknown>; checksToRun: string[]; reasoning: string };
type SessionResponse = { plan: Plan; verdict: Verdict; checks: CheckResult[]; narration: string | null };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DiverAgentSession() {
  const { credential } = useApiKey();
  const [inputKind, setInputKind] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [useClaudeCli, setUseClaudeCli] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResponse | null>(null);

  const backendReady = Boolean(credential) || (CLAUDE_CLI_ENABLED && useClaudeCli);
  const hasInput = inputKind === "text" ? text.trim().length > 0 : imageDataUrl !== null;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageDataUrl(await fileToDataUrl(file));
  }

  async function handleRun() {
    if (!hasInput || !backendReady) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const backend =
        CLAUDE_CLI_ENABLED && useClaudeCli
          ? { type: "claude-cli" as const }
          : credential
            ? {
                type: "provider" as const,
                providerId: credential.providerId,
                apiKey: credential.apiKey,
                model: DEFAULT_MODELS[credential.providerId],
              }
            : null;
      if (!backend) throw new Error("No backend available.");

      const input =
        inputKind === "text" ? { kind: "text" as const, text } : { kind: "image" as const, dataUrl: imageDataUrl! };

      const res = await fetch("/api/diver/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, backend }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
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

          {CLAUDE_CLI_ENABLED && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useClaudeCli}
                onChange={(e) => setUseClaudeCli(e.target.checked)}
              />
              Use my local Claude Code session instead of a provider key (dev-only)
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton onClick={handleRun} disabled={loading || !hasInput || !backendReady}>
              {loading ? "Running..." : "Run agent session"}
            </Button>
            {!backendReady && (
              <span className="text-xs text-muted-foreground">
                Connect a provider key above to run an agent session.
              </span>
            )}
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
          <Narration text={result.narration} />
        </div>
      )}
    </div>
  );
}
