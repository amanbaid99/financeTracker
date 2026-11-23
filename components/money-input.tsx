"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Rupee input that shows Indian digit grouping (1,20,000) as you type. */
export function MoneyInput({
  value,
  onChange,
  className,
  id,
  name,
  placeholder = "0",
  required,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  "aria-label"?: string;
}) {
  // Keep the editing text separate so parents that normalise null to 0 do not
  // immediately refill a cleared field. The controlled value wins on blur.
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? (value == null ? "" : fmt.format(value));
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="tabular h-10 w-full min-w-0 rounded-lg border border-input bg-card pl-7 pr-3 text-base sm:text-sm placeholder:text-muted-foreground"
        value={display}
        onFocus={(e) => {
          setDraft(value == null ? "" : fmt.format(value));
          if (value === 0) e.currentTarget.select();
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          const amount = digits === "" ? null : Math.min(Number(digits), 1e13);
          setDraft(amount === null ? "" : fmt.format(amount));
          onChange(amount);
        }}
      />
    </div>
  );
}
