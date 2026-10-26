import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import { AskChat, AskConsent } from "@/components/ask-chat";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { requireUser } from "@/lib/data";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("ai_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  const configured = openRouterSettings() !== null;

  return (
    <main className="space-y-4">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <GuideButton id="ask" />
      </div>
      {!configured ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Ask isn&apos;t set up yet. It needs an OpenRouter key on the server.
        </p>
      ) : data?.ai_enabled ? (
        <AskChat />
      ) : (
        <AskConsent />
      )}
    </main>
  );
}
