import { notFound } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { agents, getAgent } from "@/lib/agents";

export function generateStaticParams() {
  return agents.map((agent) => ({ agent: agent.slug }));
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{agent.description}</p>
      </div>

      <Tabs defaultValue="inspector">
        <TabsList>
          <TabsTrigger value="inspector">Inspector</TabsTrigger>
          <TabsTrigger
            value="evals"
            render={<Link href={`/agents/${agent.slug}/evals`}>Evals</Link>}
          />
        </TabsList>
        <TabsContent value="inspector" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Paste input below. No API key configured yet — key entry and the actual model call
            come next.
          </p>
          <Textarea placeholder="Paste input here..." rows={10} />
          <Button disabled>Run (not wired up yet)</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
