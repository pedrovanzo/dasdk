"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { useHoverSpeed, type AnimSpeed } from "@/lib/use-hover-speed";

export type ShowcaseSection = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  Animation: ComponentType<{ speed: AnimSpeed }>;
};

function ShowcasePanel({ section }: { section: ShowcaseSection }) {
  const { speed, hoverHandlers } = useHoverSpeed();
  const Icon = section.icon;
  const Animation = section.Animation;

  return (
    <Link
      href={section.href}
      className="group relative flex flex-1 flex-col gap-4 px-6 py-10 transition-colors hover:bg-foreground/[0.03]"
      {...hoverHandlers}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h3 className="text-lg font-medium">{section.title}</h3>
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{section.description}</p>
      <div className="flex min-h-[160px] flex-1 items-center justify-center">
        <Animation speed={speed} />
      </div>
    </Link>
  );
}

/** Three panels of equal width, separated by vertical dividers. Each panel speeds up its animation on hover/focus. */
export function DiagonalShowcase({ sections }: { sections: ShowcaseSection[] }) {
  return (
    <div className="relative flex flex-col divide-y overflow-hidden rounded-lg border sm:flex-row sm:divide-y-0">
      {sections.map((section) => (
        <ShowcasePanel key={section.title} section={section} />
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 bottom-10 left-1/3 hidden w-px bg-border sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 bottom-10 left-2/3 hidden w-px bg-border sm:block"
      />
    </div>
  );
}
