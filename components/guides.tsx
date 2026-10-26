"use client";

import { Info, Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { markGuideSeen, markWhatsNewSeen } from "@/lib/guide-actions";
import { GUIDES, type GuideId, type Release } from "@/lib/guides";

const Ctx = createContext<{
  seen: Set<string>;
  markSeen: (id: GuideId) => void;
  resetSeen: () => void;
  /** True while "What's new" is up, so guides wait their turn. */
  busy: boolean;
}>({ seen: new Set(), markSeen: () => {}, resetSeen: () => {}, busy: false });

/** Lets Settings clear the guides this session has already marked seen. */
export const useGuides = () => useContext(Ctx);

export function GuidesProvider({
  seenGuides,
  releases,
  children,
}: {
  seenGuides: string[];
  releases: Release[];
  children: React.ReactNode;
}) {
  const [seen, setSeen] = useState(() => new Set(seenGuides));
  const [showNew, setShowNew] = useState(releases.length > 0);
  const markSeen = useCallback((id: GuideId) => {
    setSeen((s) => new Set(s).add(id));
    void markGuideSeen(id);
  }, []);
  const resetSeen = useCallback(() => setSeen(new Set()), []);
  const closeNew = useCallback(() => {
    setShowNew(false);
    void markWhatsNewSeen();
  }, []);

  return (
    <Ctx.Provider value={{ seen, markSeen, resetSeen, busy: showNew }}>
      {children}
      {showNew && <WhatsNewSheet releases={releases} onClose={closeNew} />}
    </Ctx.Provider>
  );
}

export function WhatsNewSheet({
  releases,
  onClose,
}: {
  releases: Release[];
  onClose: () => void;
}) {
  return (
    <Sheet title="What's new" onClose={onClose}>
      <div className="space-y-5">
        {releases.map((r) => (
          <section key={r.date} className="space-y-3" aria-label={r.title}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {r.title}
            </p>
            <ul className="space-y-3">
              {r.items.map((it) => (
                <li key={it.title} className="flex gap-3">
                  <span
                    className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                    aria-hidden
                  >
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">{it.title}</p>
                    <p className="text-muted-foreground">{it.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Button type="button" className="w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * (i) button next to a page title. Opens the section's guide on the first
 * visit, and any time it's tapped after that.
 */
export function GuideButton({ id }: { id: GuideId }) {
  const { seen, markSeen, busy } = useContext(Ctx);
  const [tapped, setTapped] = useState(false);
  const first = !seen.has(id);
  const open = tapped || (first && !busy);

  const close = useCallback(() => {
    setTapped(false);
    if (first) markSeen(id);
  }, [first, id, markSeen]);

  const g = GUIDES[id];
  return (
    <>
      <button
        type="button"
        onClick={() => setTapped(true)}
        aria-label={`Guide: ${GUIDES[id].title}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Info className="size-5" aria-hidden />
      </button>
      {open && (
        <Sheet title={g.title} onClose={close}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">{g.intro}</p>
            <ol className="space-y-3">
              {g.steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <Button type="button" className="w-full" onClick={close}>
              Got it
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
