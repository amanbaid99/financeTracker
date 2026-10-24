"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/input";
import { completeOnboarding } from "@/lib/actions";
import { DISCLAIMER } from "@/lib/legal";
import { StepShell } from "./step-shell";

export function FinishForm({ back, aiAvailable }: { back: string | null; aiAvailable: boolean }) {
  const [agree, setAgree] = useState(false);
  const [ai, setAi] = useState(false);
  return (
    <StepShell
      optional={false}
      editing={false}
      next="/dashboard"
      back={back}
      saveLabel="Show my next focus"
      onSave={() => completeOnboarding({ disclaimer: agree, ai })}
    >
      <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">{DISCLAIMER}</div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
        <span>I understand. Tracker gives general, category-level suggestions, not investment advice.</span>
      </label>
      {aiAvailable && (
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Checkbox checked={ai} onChange={(e) => setAi(e.target.checked)} />
          <span>
            <span className="font-medium">Turn on AI explanations (optional).</span>{" "}
            <span className="text-muted-foreground">
              Only rounded numbers like &quot;gap ₹2.4L&quot; are sent to an AI model, never your name, email, age,
              city or fund names. You can turn this off any time.{" "}
              <a href="/privacy" target="_blank" className="underline">
                Details
              </a>
            </span>
          </span>
        </label>
      )}
    </StepShell>
  );
}
