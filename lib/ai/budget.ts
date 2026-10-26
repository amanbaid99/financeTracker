import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiSettings } from "@/lib/ai/openrouter";
import type { Database } from "@/lib/supabase/database.types";

/** True while this person is under today's cap on paid AI requests. */
export async function userMayPay(
  supabase: SupabaseClient<Database>,
  s: AiSettings,
): Promise<boolean> {
  if (!s.allowPaid || s.paidPerUserDaily <= 0) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("tier", "paid")
    .gte("created_at", since);
  return !error && (count ?? 0) < s.paidPerUserDaily;
}
