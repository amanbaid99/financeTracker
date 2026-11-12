"use client";

import "./globals.css";
import { ErrorView } from "@/components/error-view";

/** Crashes in the root layout itself: its own document, with the base styles. */
export default function GlobalError(props: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en-IN" data-theme="white" data-accent="green">
      <body className="min-h-full bg-background text-foreground">
        <title>Something went wrong · Tracker</title>
        <ErrorView {...props} />
      </body>
    </html>
  );
}
