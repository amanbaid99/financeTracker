"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useGuides } from "@/components/guides";
import { useTour } from "@/components/tour";
import { Button } from "@/components/ui/button";
import { resetGuides } from "@/lib/guide-actions";
import { INTRO_TOUR } from "@/lib/tour";

const row =
  "flex min-h-12 items-center justify-between border-b text-sm font-medium last:border-b-0";

export function GuideSettings() {
  const { resetSeen } = useGuides();
  const tour = useTour();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-3">
      <div>
        <Link href="/help" className={row}>
          Help and common questions
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <Link href="/whats-new" className={row}>
          What&apos;s new, every update
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => tour(INTRO_TOUR)}
          className={`${row} w-full text-left text-primary`}
        >
          Take the tour
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Each section also has a short guide behind the (i) next to its title.
      </p>
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
      {done && (
        <p role="status" className="text-sm text-success">
          Guides will show again when you open each section.
        </p>
      )}
    </div>
  );
}
