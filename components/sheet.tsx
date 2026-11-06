"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** A native modal keeps focus inside and makes the page behind it inert. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  useEffect(() => {
    const panel = dialog.current;
    if (!mounted || !panel) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.showModal();
    const input = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      ),
    ).find(
      (el) =>
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden",
    );
    // On a phone, focusing an input opens the keyboard over the sheet before
    // you've seen it. Focus the sheet itself there; tap a box to type.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const target = touch
      ? panel.querySelector<HTMLElement>("[data-sheet-panel]")
      : (input ?? panel.querySelector<HTMLElement>("button"));
    target?.focus({ preventScroll: true });
    // Keep the sheet in the space above the on-screen keyboard.
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv) return;
      panel.style.height = `${vv.height}px`;
      panel.style.top = `${vv.offsetTop}px`;
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      panel.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [mounted]);
  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Portalled child sheets still bubble React events to their parent.
        if (
          event.target instanceof Element &&
          event.target.closest("dialog") !== event.currentTarget
        )
          return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) =>
            el.tabIndex >= 0 &&
            el.getClientRects().length > 0 &&
            getComputedStyle(el).visibility !== "hidden",
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-end justify-center border-0 bg-transparent p-0 text-foreground open:flex backdrop:bg-transparent sm:items-center"
    >
      <div
        className="sheet-backdrop absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        data-sheet-panel
        tabIndex={-1}
        className="sheet-panel relative max-h-[90%] outline-none w-full overflow-y-auto overscroll-contain rounded-t-3xl border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-3xl"
      >
        <div
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-border sm:hidden"
          aria-hidden
        />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
