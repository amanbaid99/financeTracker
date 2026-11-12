import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { HelpList } from "@/components/help-list";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <main className="space-y-4">
      <BackLink fallback="/settings" label="Settings" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground">
          How the app works, in plain words. Tap a question for the answer.
        </p>
      </div>
      <HelpList />
    </main>
  );
}
