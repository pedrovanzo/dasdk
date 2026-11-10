import { notFound } from "next/navigation";
import { agents, getAgent } from "@/lib/agents";
import { DiverEvalsRunner } from "@/components/diver-evals-runner";
import { WebSearchAgentEvalsRunner } from "@/components/web-search-agent-evals-runner";

// One entry per agent with a wired-up eval runner. Agents not listed here either aren't wired up
// yet, or (see AgentDefinition.localOnly) are a Python/ADK-style agent with no sdk-side runner at all.
const EVAL_RUNNERS: Record<string, () => React.ReactNode> = {
  diver: () => <DiverEvalsRunner />,
  "web-search-agent": () => <WebSearchAgentEvalsRunner />,
};

export function generateStaticParams() {
  return agents.map((agent) => ({ agent: agent.slug }));
}

export const instant = false;

export default async function AgentEvalsPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{agent.name} — Evals</h1>
      {agent.slug in EVAL_RUNNERS ? (
        EVAL_RUNNERS[agent.slug]()
      ) : agent.localOnly ? (
        <p className="text-muted-foreground">
          This is a Python/ADK-style agent that runs as a standalone local package — its evals (if any)
          would run locally too, not through this harness. See <code>agents/{agent.slug}/README.md</code>.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Eval runner not wired up yet. Test cases and graders will be co-located with each agent
          under <code>agents/{agent.slug}/evals/</code>.
        </p>
      )}
    </div>
  );
}
