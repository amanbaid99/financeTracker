import { NextResponse, type NextRequest } from "next/server";
import { finishSignIn } from "@/lib/auth-finish";
import { createClient } from "@/lib/supabase/server";

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
        ? "Open the sign-in link in the same browser you requested it from, or type the code from the email instead."
        : (error?.message ?? "Sign-in failed. Try again."),
    );
  }

  const to = await finishSignIn(supabase, data.user.id, searchParams.get("consent"));
  return NextResponse.redirect(new URL(to, origin));
}
