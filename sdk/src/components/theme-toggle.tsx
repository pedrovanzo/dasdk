"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Terminal } from "lucide-react";

const THEMES = ["light", "dark", "matrix"] as const;
const ICONS = { light: Sun, dark: Moon, matrix: Terminal } as const;
const LABELS = { light: "Light", dark: "Dark", matrix: "Matrix" } as const;

function subscribeNever() {
  return () => {};
}

/**
 * `theme` is undefined during SSR/first client render (next-themes reads localStorage only
 * after mount) — `useSyncExternalStore` with a server/client snapshot mismatch (rather than
 * `useEffect` + `setState`) is the repo's established way to admit "the client has now
 * mounted" without the set-state-in-effect lint rule firing (see `use-api-key.ts`).
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const current = mounted ? (theme as (typeof THEMES)[number]) ?? "light" : "light";
  const Icon = ICONS[current];

  return (
    <button
      type="button"
      onClick={() => {
        const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
        setTheme(next);
      }}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle color theme"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {LABELS[current]}
    </button>
  );
}
