"use client";

import { useState } from "react";
import { isToolUIPart, getToolName } from "ai";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useModelBackend } from "@/lib/use-model-backend";
import { ModelBackendPicker } from "@/components/model-backend-picker";
import { UsageLine } from "@/components/diver-shared";
import { askWebSearchAgent, extractAnswerText, type WebSearchAgentMessage as AgentMessage } from "@/lib/web-search-client";

const EXAMPLE_QUESTION = "What is the current population of Brazil, per the latest official estimate?";

function toolQueryFromInput(input: unknown): string | null {
  if (input != null && typeof input === "object" && "query" in input) {
    const query = (input as { query?: unknown }).query;
    if (typeof query === "string") return query;
  }
  return null;
}

/** Renders one tool-invocation part — a search call, in whichever state it's currently in. */
function ToolCallCard({ part }: { part: AgentMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const query = toolQueryFromInput(part.input);

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{toolName}</Badge>
        <span className="text-xs text-muted-foreground">{part.state}</span>
      </div>
      {query && <p className="text-muted-foreground">Searching: &quot;{query}&quot;</p>}
      {part.state === "output-available" && (
        <ToolOutput output={part.output} />
      )}
      {part.state === "output-error" && (
        <p className="text-destructive">{part.errorText}</p>
      )}
    </div>
  );
}

/** Best-effort rendering of a provider-executed search tool's output — shape varies by provider. */
function ToolOutput({ output }: { output: unknown }) {
  if (Array.isArray(output)) {
    const results = output.filter(
      (entry): entry is { url?: unknown; title?: unknown } => entry != null && typeof entry === "object"
    );
    if (results.length === 0) return null;
    return (
      <ul className="flex flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
        {results.map((entry, i) => {
          const url = typeof entry.url === "string" ? entry.url : undefined;
          const title = typeof entry.title === "string" ? entry.title : url;
          if (!url) return null;
          return (
            <li key={i} className="list-disc">
              <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {title ?? url}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }
  return null;
}

function isSourceUrlPart(
  part: AgentMessage["parts"][number]
): part is Extract<AgentMessage["parts"][number], { type: "source-url" }> {
  return part.type === "source-url";
}

function SourceList({ message }: { message: AgentMessage }) {
  const sources = message.parts.filter(isSourceUrlPart);
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">Sources</span>
      <ul className="flex flex-col gap-0.5 pl-4 text-sm">
        {sources.map((source) => (
          <li key={source.sourceId} className="list-disc">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {source.title ?? source.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WebSearchAgentInspector() {
  const model = useModelBackend();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<AgentMessage | null>(null);

  async function handleAsk() {
    if (!question.trim() || !model.backendReady || !model.backend) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await askWebSearchAgent(model.backend, question, {
        onMessage: setMessage,
        onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const toolParts = message?.parts.filter(isToolUIPart) ?? [];
  const answerText = message ? extractAnswerText(message) : "";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask a question</CardTitle>
          <CardDescription>
            A real multi-step tool-use loop: the model decides when to search the web, you watch each
            search call happen, then it synthesizes a cited answer from what it found.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something that needs up-to-date information..."
          />
          <ModelBackendPicker model={model} />
          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton onClick={handleAsk} disabled={loading || !question.trim() || !model.backendReady}>
              {loading ? "Searching..." : "Ask"}
            </Button>
            <Button nativeButton variant="outline" onClick={() => setQuestion(EXAMPLE_QUESTION)}>
              Try an example
            </Button>
          </div>
          {model.effectiveBackend === "claude-cli" && (
            <p className="text-xs text-muted-foreground">
              Using your local Claude Code session — it has its own built-in web search, so no search
              trace is shown below for this backend, only the final answer.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(toolParts.length > 0 || answerText) && (
        <div className="flex flex-col gap-4">
          {toolParts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search trace</CardTitle>
                <CardDescription>Every tool call the model made, in order.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {toolParts.map((part) => (
                  <ToolCallCard key={part.toolCallId} part={part} />
                ))}
              </CardContent>
            </Card>
          )}

          {(answerText || message) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Answer</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {answerText ? (
                  <p className="whitespace-pre-wrap text-sm">{answerText}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                )}
                {message && <SourceList message={message} />}
                <UsageLine usage={message?.metadata?.usage} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
