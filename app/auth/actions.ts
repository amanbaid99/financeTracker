"use server";

import { finishSignIn } from "@/lib/auth-finish";
import { createClient } from "@/lib/supabase/server";

/** Called by the login form after the email code is verified in the browser. */
export async function completeCodeSignIn(consentVersion: string): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Sign-in didn't stick. Try the code again." };
  const next = await finishSignIn(supabase, data.user.id, consentVersion);
  return { ok: true, next };
}
