"use client";

import { Check, FileText, ScanLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardReadingStage = "permission" | "pdf" | "features";

/** Real request phases only. No simulated percentage or timed completion claims. */
export function CardReadingProgress({
  stage,
  isPdf,
}: {
  stage: CardReadingStage;
  isPdf: boolean;
}) {
  const preparing = stage !== "features";
  const steps = [
    {
      label: isPdf ? "Read the PDF" : "Prepare your text",
      icon: FileText,
      done: !preparing,
      active: preparing,
    },
    {
      label: "Find and check card features",
      icon: ScanLine,
      done: false,
      active: !preparing,
    },
    {
      label: "Ready for your review",
      icon: ShieldCheck,
      done: false,
      active: false,
    },
  ];
  return (
    <section
      className="flex min-h-96 flex-col justify-center px-2 py-8"
      aria-busy="true"
      aria-label="Reading card features"
    >
      <div className="relative mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-primary-soft text-primary">
        <div
          className="absolute inset-0 rounded-3xl border-2 border-primary/25 motion-safe:animate-pulse"
          aria-hidden
        />
        <ScanLine className="size-10 motion-safe:animate-pulse" aria-hidden />
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center"
      >
        <h2 className="text-xl font-semibold">
          {stage === "permission"
            ? "Getting the reader ready"
            : stage === "pdf"
              ? "Reading your PDF"
              : "Reading and checking your features"}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          {stage === "permission"
            ? "Recording your AI preference."
            : stage === "pdf"
              ? "Extracting the text from your document."
              : "Looking for rewards, fees, lounge benefits and their conditions. This can take a minute."}
        </p>
      </div>
      <ol className="mx-auto mt-7 w-full max-w-xs space-y-4">
        {steps.map(({ label, icon: Icon, done, active }) => (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 text-sm",
              active
                ? "font-medium text-foreground"
                : done
                  ? "text-primary"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                active || done ? "bg-primary-soft text-primary" : "bg-muted",
              )}
            >
              {done ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Icon
                  className={cn(
                    "size-4",
                    active && "motion-safe:animate-pulse",
                  )}
                  aria-hidden
                />
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <p className="mt-7 text-center text-xs text-muted-foreground">
        Nothing is saved. You check and confirm next.
      </p>
    </section>
  );
}
