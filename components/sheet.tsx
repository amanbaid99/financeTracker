"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";

/** A panel that slides up on phones and sits centred on larger screens. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
