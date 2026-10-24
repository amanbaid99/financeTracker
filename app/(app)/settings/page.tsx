import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AccountSettings,
  AiSettings,
  AssumptionSettings,
  ThemeSettings,
} from "@/components/forms/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aiConfigured } from "@/lib/ai/config";
import { loadAnalysis, requireUser } from "@/lib/data";
import { defaultConfig } from "@/lib/engine/config";
import { formatDate } from "@/lib/format";
import { asAccent, asTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Settings" };

const CONSENT_LABELS: Record<string, string> = {
  privacy_policy: "Privacy policy",
  disclaimer: "Not-investment-advice disclaimer",
  ai_processing: "AI explanations",
};

export default async function SettingsPage() {
  const { raw, analysis } = await loadAnalysis();
  const { supabase, user } = await requireUser();
  const { data: consents } = await supabase
    .from("consents")
    .select("kind, version, granted, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const c = analysis.config;
  const d = defaultConfig;
  const toValues = (x: typeof c) => ({
    healthCoverMetro: x.ladder.healthCoverMetro,
    healthCoverOther: x.ladder.healthCoverOther,
    termIncomeMultiple: x.ladder.termIncomeMultiple,
    termCoverTarget: x.ladder.termCoverTarget,
    highInterestThresholdPct: x.ladder.highInterestThresholdPct,
    retirementAge: x.goals.retirementAge,
  });


  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email} · profile {analysis.completeness.score}% complete
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your information</CardTitle>
          <CardDescription>Every answer can be changed. More answers mean sharper suggestions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/details" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:text-primary">
            <span>Update income, expenses, insurance, loans, household and more</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Look</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSettings theme={asTheme(raw.profile.theme)} accent={asAccent(raw.profile.accent)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI explanations</CardTitle>
        </CardHeader>
        <CardContent>
          <AiSettings enabled={raw.profile.ai_enabled} configured={aiConfigured()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planning assumptions</CardTitle>
          <CardDescription>Change the thresholds the plan uses. Leave a field at its default to keep it.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssumptionSettings values={toValues(c)} defaults={toValues(d)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy and consent</CardTitle>
          <CardDescription>
            What you agreed to and when.{" "}
            <Link href="/privacy" className="underline">
              Read the privacy policy
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {(consents ?? []).map((x) => (
              <li key={`${x.kind}-${x.created_at}`} className="flex justify-between gap-3 py-2">
                <span>
                  {CONSENT_LABELS[x.kind] ?? x.kind}
                  {x.granted ? "" : " (withdrawn)"}
                </span>
                <span className="text-muted-foreground">{formatDate(x.created_at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettings />
        </CardContent>
      </Card>
    </main>
  );
}
