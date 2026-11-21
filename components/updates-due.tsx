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
  compact=false,
}: {
  items: UpdateDue[];
  today: string;
  compact?:boolean;
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
      className={compact?"rounded-xl border border-border/70 bg-card p-3 space-y-2":"rounded-2xl border bg-card p-4 space-y-2"}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <h2 className="font-medium">{compact?"Update needed":"Updates due"}</h2>
        <span className="text-muted-foreground">{compact?(items.length>1?`+${items.length-1} more`:null):items.length}</span>
      </div>
      <p className={compact?"break-words text-sm font-medium":"font-semibold break-words"}>{item.title}</p>
      <p className={compact?"text-xs text-muted-foreground":"text-sm text-muted-foreground"}>{item.detail}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={item.href} className={buttonVariants({ size: "sm" })}>
          Update
        </Link>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label="Remind me tomorrow"
          onClick={() =>
            start(async () => {
              setError("");
              const result = await snoozeUpdate(item.key);
              if (!result.ok) setError(result.error ?? "Try again.");
              else router.refresh();
            })
          }
        >
          {compact?"Tomorrow":"Remind me tomorrow"}
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
