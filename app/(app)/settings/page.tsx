import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AccountSettings,
  AskSettings,
  ThemeSettings,
} from "@/components/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGoals, requireUser } from "@/lib/data";
import { asAccent, asTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { theme, accent } = await loadGoals();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <main className="space-y-5">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Goals
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Look</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSettings theme={asTheme(theme)} accent={asAccent(accent)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ask</CardTitle>
        </CardHeader>
        <CardContent>
          <AskSettings enabled={profile?.ai_enabled ?? false} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettings />
          <p className="mt-4 text-sm">
            <Link href="/privacy" className="text-primary underline">
              Privacy policy
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
