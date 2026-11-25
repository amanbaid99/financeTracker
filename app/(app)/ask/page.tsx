import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import { AskChat, AskConsent } from "@/components/ask-chat";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { loadSnapshot } from "@/lib/data";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const data = (await loadSnapshot()).profile;
  const configured = openRouterSettings() !== null;

  return (
    <main className="space-y-4">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <GuideButton id="ask" />
      </div>
      <AskChat
        initialTopic={
          !configured || !data?.ai_enabled || topic === "cards"
            ? "cards"
            : "money"
        }
        localOnly={!configured || !data?.ai_enabled}
      />
      {configured && !data?.ai_enabled && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm text-primary">
            Enable AI for broader questions
          </summary>
          <div className="mt-4">
            <AskConsent />
          </div>
        </details>
      )}
    </main>
  );
}
