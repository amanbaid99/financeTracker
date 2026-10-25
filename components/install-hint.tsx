"use client";

import { Plus, Share, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "tracker_install_hint_dismissed";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True when running as an installed Home Screen app. */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribe, isStandalone, () => false);
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

type Platform = "ios" | "android" | "other";
function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/**
 * "Use Tracker like an app" tip with Add to Home Screen steps. Hidden when
 * already installed or after it's dismissed.
 */
export function InstallHint({ className }: { className?: string }) {
  const standalone = useIsStandalone();
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const os = useSyncExternalStore(subscribe, platform, () => "other" as Platform);
  if (standalone || dismissed) return null;

  return (
    <aside
      aria-label="Add Tracker to your Home Screen"
      className={`relative space-y-2 rounded-xl border bg-card p-4 text-sm ${className ?? ""}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // Storage blocked: the tip just shows again next time.
          }
          listeners.forEach((l) => l());
        }}
      >
        <X />
      </Button>
      <div className="flex items-center gap-2 pr-8">
        <LogoMark className="size-6" />
        <p className="font-medium">Use Tracker like an app</p>
      </div>
      {os === "android" ? (
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Tap the ⋮ menu in Chrome.</li>
          <li>
            Tap <span className="font-medium text-foreground">Install app</span> or{" "}
            <span className="font-medium text-foreground">Add to Home screen</span>.
          </li>
        </ol>
      ) : os === "ios" ? (
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            In Safari, tap <Share className="inline size-4 align-text-bottom text-foreground" aria-label="Share" />{" "}
            <span className="font-medium text-foreground">Share</span>.
          </li>
          <li>
            Tap <Plus className="inline size-4 align-text-bottom text-foreground" aria-hidden />{" "}
            <span className="font-medium text-foreground">Add to Home Screen</span>, then Add.
          </li>
          <li>Open Tracker from your Home Screen and sign in once with the email code.</li>
        </ol>
      ) : (
        <p className="text-muted-foreground">
          On your phone, open this page and choose <span className="font-medium text-foreground">Add to Home Screen</span>{" "}
          (iPhone: Share menu; Android: ⋮ menu). It opens full screen and keeps you signed in.
        </p>
      )}
    </aside>
  );
}
