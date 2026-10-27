import "server-only";
import { cookies } from "next/headers";
import { PRIVACY_VERSION } from "@/lib/legal";
import type { createClient } from "@/lib/supabase/server";
import { ACCENT_COOKIE, THEME_COOKIE, THEME_COOKIE_OPTIONS } from "@/lib/theme";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Runs after any successful sign-in (email link, email code or Google):
 * records the privacy consent given on the login screen, restores the user's
 * theme cookies and says where to go next.
 */
export async function finishSignIn(supabase: Supabase, userId: string, consentVersion: string | null) {
  if (consentVersion === PRIVACY_VERSION) {
    const { data: existing } = await supabase
      .from("consents")
      .select("id")
      .eq("kind", "privacy_policy")
      .eq("version", PRIVACY_VERSION)
      .limit(1);
    if (!existing?.length) {
      await supabase.from("consents").insert({ kind: "privacy_policy", version: PRIVACY_VERSION });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme, accent")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) {
    const store = await cookies();
    store.set(THEME_COOKIE, profile.theme, THEME_COOKIE_OPTIONS);
    store.set(ACCENT_COOKIE, profile.accent, THEME_COOKIE_OPTIONS);
  }
  return "/goals";
}
