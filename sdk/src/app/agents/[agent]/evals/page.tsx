import { notFound } from "next/navigation";
import { agents, getAgent } from "@/lib/agents";

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
      <p className="text-muted-foreground">
        Eval runner not wired up yet. Test cases and graders will be co-located with each agent
        under <code>agents/{agent.slug}/evals/</code>.
      </p>
    </div>
  );
}
