export type AgentDefinition = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
};

export const agents: AgentDefinition[] = [
  {
    slug: "diver",
    name: "Diver",
    tagline: "Is this email real?",
    description:
      "Checks a pasted raw email source against a checklist of free, deterministic signals (homoglyph detection, SPF/DKIM/DMARC, reply-to mismatch, known-brand allowlist, safe link-redirect resolution) and narrates a traffic-light verdict.",
  },
  {
    slug: "web-search-agent",
    name: "Web Search Agent",
    tagline: "Searches the web and reports back",
    description:
      "Toy agent in the Vercel AI SDK / TypeScript flavor, modeled on Matt Pocock's AI Hero web-search-agent pattern.",
  },
  {
    slug: "image-reader",
    name: "Image Reader",
    tagline: "Describes and extracts text from an image",
    description:
      "Toy agent in the Python / ADK-style flavor. Takes an uploaded image and uses a vision-capable model to describe it and extract any text.",
  },
];

export function getAgent(slug: string) {
  return agents.find((agent) => agent.slug === slug);
}
