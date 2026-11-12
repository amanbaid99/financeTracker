"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ToastInput {
  text: string;
  tone?: "success" | "danger" | "neutral";
  /** e.g. Undo. Runs once, then the toast closes. */
  action?: { label: string; onClick: () => void | Promise<unknown> };
  /** How long it stays, in ms. Default 6s, or 10s with an action. */
  duration?: number;
}

type Toast = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Shows a toast: `const toast = useToast(); toast({ text: "Saved." })`. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast needs <ToastProvider>");
  return show;
}

/**
 * One toast at a time, just above the bottom bar: short confirmations, with
 * an optional action such as Undo. A new toast replaces the last one.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const next = useRef(1);
  const show = useCallback((t: ToastInput) => {
    setToast({ ...t, id: next.current++ });
  }, []);
  useEffect(() => {
    if (!toast || busy) return;
    const ms = toast.duration ?? (toast.action ? 10000 : 6000);
    const timer = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(timer);
  }, [toast, busy]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === "danger" ? "alert" : "status"}
            className={cn(
              "toast-in pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl px-4 py-2 text-sm shadow-lg",
              toast.tone === "danger"
                ? "bg-danger text-white"
                : "bg-foreground text-background",
            )}
          >
            <span className="min-w-0 flex-1 py-1.5">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                disabled={busy}
                className="min-h-11 shrink-0 px-2 font-semibold underline underline-offset-2"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await toast.action!.onClick();
                  } finally {
                    setBusy(false);
                    setToast(null);
                  }
                }}
              >
                {busy ? "…" : toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center opacity-70"
              onClick={() => setToast(null)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
