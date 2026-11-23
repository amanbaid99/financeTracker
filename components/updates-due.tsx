"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UpdateDue } from "@/lib/updates";
import { useDayRefresh } from "@/components/use-day-refresh";
import { snoozeUpdate } from "@/lib/updates-actions";

export function UpdatesDue({
  items,
  today,
  compact=false,
  title,
}: {
  items: UpdateDue[];
  today: string;
  compact?:boolean;
  /** Heading; defaults to "Next up" (compact) or "Updates due". */
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [expanded,setExpanded]=useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useDayRefresh(today);
  const visible=compact?(expanded?items:items.slice(0,3)):items.slice(0,1);
  if (!items.length) return null;
  return (
    <section
      aria-label={title ?? "Updates due"}
      data-guide="updates-due"
      className={compact?"rounded-xl border border-border/70 bg-card p-3 space-y-2":"rounded-2xl border bg-card p-4 space-y-2"}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <h2 className="font-medium">{title ?? (compact?"Next up":"Updates due")}</h2>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      <ul className="divide-y">{visible.map(item=><li key={item.key} className="space-y-2 py-3 first:pt-0 last:pb-0">
      <p className={compact?"break-words text-sm font-medium":"font-semibold break-words"}>{item.title}</p>
      <p className={compact?"text-xs text-muted-foreground":"text-sm text-muted-foreground"}>{item.detail}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={item.href} className={buttonVariants({ size: "sm" })}>
          {item.actionLabel??"Update"}
        </Link>
        {item.snooze !== false && <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={item.optional?`Remind me next week: ${item.title}`:compact?`Remind me tomorrow: ${item.title}`:"Remind me tomorrow"}
          onClick={() =>
            start(async () => {
              setError("");
              const result = await snoozeUpdate(item.key,item.optional?7:1);
              if (!result.ok) setError(result.error ?? "Try again.");
              else router.refresh();
            })
          }
        >
          {item.optional?"Remind me next week":"Remind me tomorrow"}
        </Button>}
      </div>
      </li>)}</ul>
      {compact&&items.length>3&&<Button variant="ghost" size="sm" className="w-full" onClick={()=>setExpanded(!expanded)}>{expanded?"Show fewer":`Show ${items.length-3} more`}</Button>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
