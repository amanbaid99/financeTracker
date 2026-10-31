"use client";

import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "₹X less than before. Did you take money out?" with Yes / No. */
export function WithdrawQuestion({
  name,
  drop,
  answer,
  onAnswer,
}: {
  name: string;
  drop: number;
  answer: boolean | undefined;
  onAnswer: (withdrew: boolean) => void;
}) {
  const choice = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={answer === value}
      onClick={() => onAnswer(value)}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium",
        answer === value
          ? "border-primary bg-primary-soft text-primary"
          : "bg-card",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-1.5 rounded-lg bg-warning-soft p-2.5 text-xs">
      <p className="text-warning">
        {formatINR(drop)} less than before. Did you take money out?
      </p>
      <div
        role="radiogroup"
        aria-label={`Did you take money out of ${name}?`}
        className="flex gap-2"
      >
        {choice(true, "Yes, I withdrew")}
        {choice(false, "No, it fell")}
      </div>
    </div>
  );
}
