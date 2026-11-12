"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/lib/tour";

const Ctx = createContext<(steps: TourStep[]) => void>(() => {});

/** Starts a spotlight tour: `useTour()(INTRO_TOUR)`. */
export function useTour() {
  return useContext(Ctx);
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;

/**
 * Dims the screen, lights up one real element per step and explains it,
 * moving between pages as needed. A step whose element isn't on screen
 * (like a hidden Next step card) is skipped.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const back = useRef(false);

  const start = useCallback((s: TourStep[]) => {
    setIndex(0);
    setRect(null);
    setSteps(s.length ? s : null);
  }, []);
  const end = useCallback(() => {
    setSteps(null);
    setRect(null);
  }, []);
  const go = useCallback(
    (to: number) => {
      back.current = to < index;
      setRect(null);
      if (!steps || to >= steps.length || to < 0) end();
      else setIndex(to);
    },
    [steps, index, end],
  );

  const step = steps?.[index];
  // Go to the step's page, find its element, then keep it lit.
  useEffect(() => {
    if (!step) return;
    if (path !== step.path) {
      router.push(step.path);
      return;
    }
    let tries = 0;
    let el: Element | null = null;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const find = setInterval(() => {
      el = document.querySelector(`[data-guide="${step.target}"]`);
      if (el) {
        clearInterval(find);
        // Tall things (a whole list) line up at the top; small ones centre.
        const tall =
          el.getBoundingClientRect().height > window.innerHeight * 0.5;
        el.scrollIntoView({
          block: tall ? "start" : "center",
          behavior: "smooth",
        });
        setTimeout(measure, 350);
      } else if (++tries > 20) {
        clearInterval(find);
        // Not on screen right now: skip it, in the direction we were going.
        const to = back.current ? index - 1 : index + 1;
        if (steps && to >= 0 && to < steps.length) setIndex(to);
        else end();
      }
    }, 100);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      clearInterval(find);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [step, path, router, index, steps, end]);

  useEffect(() => {
    if (rect) card.current?.focus();
  }, [rect]);

  // The card goes below the element, else above, else at the bottom of the
  // screen when the element fills it: always fully on screen.
  const cardStyle = (() => {
    if (!rect) return {};
    const vh = window.innerHeight;
    const room = 230;
    const below = vh - (rect.top + rect.height + PAD);
    const above = rect.top - PAD;
    if (below >= room) return { top: rect.top + rect.height + PAD + 10 };
    if (above >= room) return { bottom: vh - rect.top + PAD + 10 };
    return { bottom: 88 };
  })();
  return (
    <Ctx.Provider value={start}>
      {children}
      {step && (
        <div
          className="fixed inset-0 z-[60]"
          onKeyDown={(e) => {
            if (e.key === "Escape") end();
            if (e.key === "ArrowRight") go(index + 1);
            if (e.key === "ArrowLeft") go(index - 1);
          }}
        >
          {rect ? (
            <div
              aria-hidden
              className="pointer-events-none fixed rounded-2xl ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
              style={{
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
              }}
            />
          ) : (
            <div aria-hidden className="fixed inset-0 bg-black/55" />
          )}
          {rect && (
            <div
              ref={card}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-title"
              className="fixed inset-x-4 mx-auto max-w-sm space-y-2 rounded-2xl border bg-card p-4 shadow-xl outline-none"
              style={cardStyle}
            >
              <p className="text-xs text-muted-foreground">
                {index + 1} of {steps!.length}
              </p>
              <h2 id="tour-title" className="font-semibold">
                {step.title}
              </h2>
              <p className="text-sm text-muted-foreground">{step.text}</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={end}
                  className="min-h-11 px-1 text-sm text-muted-foreground"
                >
                  Skip
                </button>
                <span className="flex gap-2">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => go(index - 1)}
                    >
                      Previous
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={() => go(index + 1)}
                  >
                    {index === steps!.length - 1 ? "Done" : "Next"}
                  </Button>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}
