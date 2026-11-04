import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { agents } from "@/lib/agents";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">dasdk</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          An agent SDK harness, scaffold, and a handful of real and demo agents — run entirely
          in your browser with your own model key. No server-held secrets, ever.
        </p>
        <div className="flex gap-3">
          <Button render={<Link href="/agents">Try the agents</Link>} />
          <Button variant="outline" render={<Link href="/docs">Read the docs</Link>} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.slug} href={`/agents/${agent.slug}`}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle>{agent.name}</CardTitle>
                <CardDescription>{agent.tagline}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
