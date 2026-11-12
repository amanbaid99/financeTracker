"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a crash looks like: what happened, that data is safe, and a way on.
 * Shared by the route error boundaries.
 */
export function ErrorView({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Shows in Vercel's logs; the digest matches the server-side entry.
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main
      role="alert"
      className="mx-auto max-w-md space-y-3 px-4 py-16 text-center"
    >
      <h1 className="text-xl font-semibold">
        {offline ? "You're offline" : "Something went wrong"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {offline
          ? "This page needs a connection. Your data is safe. Try again once you're back online."
          : "This page couldn't load. Your data is safe and nothing was changed."}
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => retry()}
          className="press inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
        <Link
          href="/goals"
          className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium"
        >
          Go to Goals
        </Link>
      </div>
    </main>
  );
}
