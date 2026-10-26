"use client";

import { Settings } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * A sliding strip along the bottom of a tab while its page loads. It fades in
 * only after a short delay, so quick switches don't flash. Always rendered,
 * so it never shifts the layout.
 */
export function TabPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 overflow-hidden opacity-0",
        pending && "nav-pending",
      )}
    >
      <span className="nav-pending-bar block h-full w-1/2 rounded-full bg-primary" />
    </span>
  );
}

function SettingsIcon() {
  const { pending } = useLinkStatus();
  return (
    <>
      <Settings
        className={cn("size-5", pending && "nav-pending-spin")}
        aria-hidden
      />
      {pending && <span className="sr-only">Loading</span>}
    </>
  );
}

/** The header's settings button; the gear spins while Settings loads. */
export function SettingsLink() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <SettingsIcon />
    </Link>
  );
}
