"use client";

import { useState } from "react";
import Link from "next/link";

const FONTS = [
  { key: "system", label: "System UI" },
  { key: "inter", label: "Inter" },
  { key: "geist", label: "Geist" },
  { key: "plex", label: "IBM Plex Sans" },
  { key: "manrope", label: "Manrope" },
  { key: "space-grotesk", label: "Space Grotesk" },
  { key: "figtree", label: "Figtree" },
  { key: "outfit", label: "Outfit" },
  { key: "dm-sans", label: "DM Sans" },
  { key: "sora", label: "Sora" },
  { key: "lexend", label: "Lexend" },
] as const;

type FontKey = (typeof FONTS)[number]["key"];

export function FontLab({ children }: { children: React.ReactNode }) {
  const [font, setFont] = useState<FontKey>("system");

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={font === "system" ? undefined : { fontFamily: `var(--font-${font})` }}
    >
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-sm">
          <Link href="/" className="font-semibold">
            dasdk
          </Link>
          <Link href="/agents" className="text-muted-foreground hover:text-foreground">
            Agents
          </Link>
          <Link href="/docs" className="text-muted-foreground hover:text-foreground">
            Docs
          </Link>
        </nav>
        <div className="mx-auto flex max-w-5xl flex-wrap gap-1.5 px-6 pb-3 text-xs">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFont(f.key)}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                font === f.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
