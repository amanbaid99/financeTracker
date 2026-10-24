"use client";

import { useState } from "react";
import { saveRisk } from "@/lib/actions";
import { RISK_QUESTIONS } from "@/lib/engine/risk";
import { cn } from "@/lib/utils";
import { StepShell } from "./step-shell";

export function RiskForm({ next, back, editing }: { next: string; back: string | null; editing: boolean }) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);

  return (
    <StepShell
      optional
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        answers.some((a) => a === null)
          ? { ok: false, error: "Answer all three, or skip for now (we'll assume moderate)." }
          : saveRisk(answers as number[])
      }
    >
      {RISK_QUESTIONS.map((q, qi) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-sm font-medium">{q.question}</legend>
          <div className="grid gap-2">
            {q.options.map((opt, oi) => (
              <label
                key={opt}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                  answers[qi] === oi && "border-primary bg-primary-soft",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="accent-[var(--primary)]"
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </StepShell>
  );
}
