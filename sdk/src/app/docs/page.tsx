const sections = [
  {
    title: "What this is",
    body: "dasdk is an ecosystem of three pieces: sdk (this harness), scaffold (a .md-driven agent generator you run locally), and agents (real and demo agents you can try right here). \"dasdk\" = default demo-project prefix (\"d\") + agent software development kit (\"asdk\").",
  },
  {
    title: "Concepts",
    body: "An agent calls tools in a loop and reacts to their results. A skill is a packaged set of instructions/resources an agent loads on demand. An eval is a test case with an expected outcome, graded automatically to check an agent still behaves correctly.",
  },
  {
    title: "How scaffold works",
    body: "Scaffold ships a small, Matt Pocock-style AGENTS.md direction file per flavor (Python, TypeScript) plus a docs/ folder loaded on demand. An LLM reads the direction file and a spec, then assembles real agent files locally into agents/<name>/. The preview here is read-only — real generation only happens when you clone the repo.",
  },
  {
    title: "The agents",
    body: "Diver checks whether an email is a spoof of a real brand (a \"Dived\" result means it passed the checklist). web-search-agent and image-reader are toy agents proving out the TypeScript and Python scaffold flavors.",
  },
  {
    title: "Stack notes",
    body: "The reference material behind this project came from a Google/Alura immersion course built on Antigravity CLI, Google ADK, Vertex AI / AI Studio, and Cloud Shell/Cloud Run. This project instead uses a mixed stack: Next.js, Vercel, the Vercel AI SDK, and plain git/GitHub — chosen for browser-first, serverless-friendly hosting.",
  },
  {
    title: "Credits",
    body: "Built after an Alura \"Imersão Dev\" course on Google ADK + Antigravity CLI, and inspired by Matt Pocock / AI Hero's AGENTS.md guidance and web-search-agent pattern.",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Docs</h1>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-xl font-medium">{section.title}</h2>
          <p className="text-muted-foreground">{section.body}</p>
        </section>
      ))}
    </div>
  );
}
