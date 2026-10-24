import { NextResponse, type NextRequest } from "next/server";
import { PRIVACY_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { ACCENT_COOKIE, THEME_COOKIE, THEME_COOKIE_OPTIONS } from "@/lib/theme";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, origin));

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail(providerError);

  const code = searchParams.get("code");
  if (!code) return fail("That sign-in link is missing its code. Request a new one.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return fail(
      error?.message.includes("code verifier")
        ? "Open the sign-in link in the same browser you requested it from."
        : (error?.message ?? "Sign-in failed. Try again."),
    );
  }

  // Record the privacy consent given on the login screen.
  if (searchParams.get("consent") === PRIVACY_VERSION) {
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
    .select("theme, accent, onboarding_completed_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const to = profile?.onboarding_completed_at ? "/dashboard" : "/onboarding/basics";
  const response = NextResponse.redirect(new URL(to, origin));
  if (profile) {
    response.cookies.set(THEME_COOKIE, profile.theme, THEME_COOKIE_OPTIONS);
    response.cookies.set(ACCENT_COOKIE, profile.accent, THEME_COOKIE_OPTIONS);
  }
  return response;
}
