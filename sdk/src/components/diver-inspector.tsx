"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DiverQuickCheck } from "@/components/diver-quick-check";
import { DiverAgentSession } from "@/components/diver-agent-session";

export function DiverInspector() {
  const [mode, setMode] = useState<"quick" | "session">("quick");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Button nativeButton variant={mode === "quick" ? "default" : "outline"} onClick={() => setMode("quick")}>
          Quick check
        </Button>
        <Button nativeButton variant={mode === "session" ? "default" : "outline"} onClick={() => setMode("session")}>
          Agent session
        </Button>
      </div>
      {mode === "quick" ? <DiverQuickCheck /> : <DiverAgentSession />}
    </div>
  );
}
