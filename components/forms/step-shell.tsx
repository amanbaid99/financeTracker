"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";

/** Wraps a step form with Save, Skip and Back, and shows save errors. */
export function StepShell({
  children,
  onSave,
  next,
  back,
  optional,
  editing,
  saveLabel,
}: {
  children: React.ReactNode;
  onSave: () => Promise<ActionResult> | ActionResult;
  next: string;
  back: string | null;
  optional: boolean;
  editing: boolean;
  saveLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await onSave();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {children}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {back && (
            <Button type="button" variant="ghost" onClick={() => router.push(back)} disabled={pending}>
              {editing ? "Cancel" : "Back"}
            </Button>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {optional && !editing && (
            <Button type="button" variant="outline" onClick={() => router.push(next)} disabled={pending}>
              Skip for now
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : (saveLabel ?? (editing ? "Save" : "Save and continue"))}
          </Button>
        </div>
      </div>
    </form>
  );
}
