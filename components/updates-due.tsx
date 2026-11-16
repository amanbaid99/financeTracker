"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UpdateDue } from "@/lib/updates";
import { todayIST } from "@/lib/dates";
import { snoozeUpdate } from "@/lib/updates-actions";

export function UpdatesDue({
  items,
  today,
}: {
  items: UpdateDue[];
  today: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const refreshIfNewDay = () => {
      if (document.visibilityState === "visible" && todayIST() !== today)
        router.refresh();
    };
    refreshIfNewDay();
    document.addEventListener("visibilitychange", refreshIfNewDay);
    window.addEventListener("focus", refreshIfNewDay);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfNewDay);
      window.removeEventListener("focus", refreshIfNewDay);
    };
  }, [today, router]);
  const item = items[0];
  if (!item) return null;
  return (
    <section
      aria-label="Updates due"
      data-guide="updates-due"
      className="rounded-2xl border bg-card p-4 space-y-2"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <h2 className="font-medium">Updates due</h2>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      <p className="font-semibold break-words">{item.title}</p>
      <p className="text-sm text-muted-foreground">{item.detail}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={item.href} className={buttonVariants({ size: "sm" })}>
          Update
        </Link>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const result = await snoozeUpdate(item.key);
              if (!result.ok) setError(result.error ?? "Try again.");
              else router.refresh();
            })
          }
        >
          Remind me tomorrow
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
