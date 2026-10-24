"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RowCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold">{title}</legend>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${title}`}>
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function NoneCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
