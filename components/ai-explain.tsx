"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { explain } from "@/lib/ai/explain";
import type { AiFeature } from "@/lib/ai/facts";

export function AiExplain({
  feature,
  goalId,
  label = "Explain this",
}: {
  feature: AiFeature;
  goalId?: string;
  label?: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      {!text && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const res = await explain(feature, goalId);
              if (res.ok) setText(res.text);
              else setError(res.error);
            })
          }
        >
          <Sparkles /> {pending ? "Thinking…" : label}
        </Button>
      )}
      {text && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            AI explanation of the numbers above. General information, not investment advice.
          </p>
          <div className="whitespace-pre-line leading-relaxed">{text}</div>
        </div>
      )}
      {error && (
        <p className="text-xs text-muted-foreground" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
