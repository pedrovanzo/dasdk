import { notFound } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DiverInspector } from "@/components/diver-inspector";
import { agents, getAgent } from "@/lib/agents";

export function generateStaticParams() {
  return agents.map((agent) => ({ agent: agent.slug }));
}

// All params are statically generated above; this route never needs a
// blocking runtime lookup, so opt out of instant-navigation validation.
export const instant = false;

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
            nativeButton={false}
            render={<Link href={`/agents/${agent.slug}/evals`}>Evals</Link>}
          />
        </TabsList>
        <TabsContent value="inspector" className="flex flex-col gap-4">
          {agent.slug === "diver" ? (
            <DiverInspector />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This agent isn&apos;t wired up yet.
              </p>
              <Textarea placeholder="Paste input here..." rows={10} disabled />
              <Button disabled>Run (not wired up yet)</Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
