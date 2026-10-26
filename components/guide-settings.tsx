"use client";

import { useCallback, useState, useTransition } from "react";
import { useGuides, WhatsNewSheet } from "@/components/guides";
import { Button } from "@/components/ui/button";
import { resetGuides } from "@/lib/guide-actions";
import { RELEASES } from "@/lib/guides";

export function GuideSettings() {
  const { resetSeen } = useGuides();
  const [showNew, setShowNew] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const close = useCallback(() => setShowNew(false), []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each section has a short guide behind the (i) next to its title.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowNew(true)}
        >
          See what&apos;s new
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resetGuides();
              if (res.ok) {
                setDone(true);
                resetSeen();
              }
            })
          }
        >
          {pending ? "Resetting…" : "Show guides again"}
        </Button>
      </div>
      {done && (
        <p role="status" className="text-sm text-success">
          Guides will show again when you open each section.
        </p>
      )}
      {showNew && <WhatsNewSheet releases={RELEASES} onClose={close} />}
    </div>
  );
}
