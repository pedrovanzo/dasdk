"use client";

import { Bot, FlaskConical, BookOpen } from "lucide-react";
import { DiagonalShowcase, type ShowcaseSection } from "@/components/home/diagonal-showcase";
import { CircuitAnimation } from "@/components/home/circuit-animation";
import { GraphFillAnimation } from "@/components/home/graph-fill-animation";
import { TypewriterAnimation } from "@/components/home/typewriter-animation";

const SECTIONS: ShowcaseSection[] = [
  {
    href: "/agents",
    icon: Bot,
    title: "Agents",
    description:
      "Run real and demo agents right in your browser — connect your own provider key, or (locally) your Claude Code subscription.",
    Animation: CircuitAnimation,
  },
  {
    href: "/agents",
    icon: FlaskConical,
    title: "Evals",
    description:
      "Each agent's \"Evals\" tab grades it against a fixed set of known test cases — exact-match or substring, depending on the agent.",
    Animation: GraphFillAnimation,
  },
  {
    href: "/docs",
    icon: BookOpen,
    title: "Docs",
    description: "What dasdk actually is, how the scaffold generator works, and the stack behind all of it.",
    Animation: TypewriterAnimation,
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-9 w-9" aria-hidden />
          <h1 className="text-4xl font-semibold tracking-tight">dasdk</h1>
        </div>
        <p className="max-w-2xl text-lg text-muted-foreground">
          An agent SDK harness, scaffold, and a handful of real and demo agents — run entirely
          in your browser with your own model key. No server-held secrets, ever.
        </p>
      </div>

      <DiagonalShowcase sections={SECTIONS} />
    </div>
  );
}
