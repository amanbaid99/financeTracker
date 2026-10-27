import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AccountSettings,
  AskSettings,
  ThemeSettings,
} from "@/components/settings-forms";
import { GuideSettings } from "@/components/guide-settings";
import { InviteSettings } from "@/components/invite-settings";
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
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const invites = isAdmin
    ? ((await supabase.rpc("list_invites")).data ?? [])
    : [];
  return (
    <main className="space-y-5">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Home
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
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite people</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteSettings
              me={(user.email ?? "").toLowerCase()}
              invites={invites.map((i) => ({
                email: i.email,
                note: i.note,
                joined: i.joined,
              }))}
            />
          </CardContent>
        </Card>
      )}
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
          <CardTitle>Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <GuideSettings />
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
