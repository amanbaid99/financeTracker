"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Unsaved form drafts on this device, so a refresh or a closed sheet doesn't
// lose what you typed. Per-device convenience only: nothing goes to the
// server until you press Save.
const EVENT = "form-draft-change";

function read(key: string | null): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: drafts just aren't kept.
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Keeps `value` as a draft under `key` (null turns drafts off). A draft left
 * from before is offered first: until you Restore or Discard it, nothing
 * overwrites it. Call `clear()` after saving.
 */
export function useDraft<T>(
  key: string | null,
  value: T,
  /** True while the form is still blank, so opening it saves nothing. */
  empty: boolean,
) {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const [decided, setDecided] = useState(false);
  const json = JSON.stringify(value);
  const pending = !decided && stored !== null && stored !== json;
  useEffect(() => {
    if (!key || pending) return;
    const timer = setTimeout(() => write(key, empty ? null : json), 400);
    return () => clearTimeout(timer);
  }, [key, json, empty, pending]);
  return {
    /** A draft from before, waiting for Restore or Discard. */
    draft: pending ? (JSON.parse(stored!) as T) : null,
    restore: () => setDecided(true),
    discard: () => {
      if (key) write(key, null);
      setDecided(true);
    },
    clear: () => {
      if (key) write(key, null);
    },
  };
}

/** "You have an unsaved X from before." with Restore and Discard. */
export function DraftBanner({
  what,
  onRestore,
  onDiscard,
}: {
  what: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft p-2.5 text-sm"
    >
      <span>You have an unsaved {what} from before.</span>
      <span className="flex gap-1">
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-9 rounded-md px-2 text-muted-foreground"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="min-h-9 rounded-md bg-card px-3 font-medium text-primary shadow-sm"
        >
          Restore
        </button>
      </span>
    </div>
  );
}
