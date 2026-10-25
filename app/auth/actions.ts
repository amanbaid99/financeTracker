"use server";

import { finishSignIn } from "@/lib/auth-finish";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; next: string } | { ok: false; error: string };

/**
 * Verifies the emailed code on the server. The session is then written as
 * server-set cookies (long-lived), which matters for Home Screen apps on
 * iPhone: cookies set from page scripts are capped at 7 days there.
 */
export async function verifyEmailCode(email: string, code: string, consentVersion: string): Promise<Result> {
  const token = code.replace(/\D/g, "");
  if (token.length < 6 || token.length > 10) return { ok: false, error: "Enter the code from the email." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "That code didn't work." };
  const next = await finishSignIn(supabase, data.user.id, consentVersion);
  return { ok: true, next };
}
