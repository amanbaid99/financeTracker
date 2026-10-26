"use server";

import { z } from "zod";
import { GUIDE_IDS, LATEST_RELEASE } from "@/lib/guides";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Signed out");
  return { supabase, userId: data.user.id };
}

const guideId = z.enum(GUIDE_IDS as [string, ...string[]]);

/** Remembers that a section's guide was shown, so it doesn't pop up again. */
export async function markGuideSeen(id: string): Promise<Result> {
  try {
    const g = guideId.parse(id);
    const { supabase, userId } = await session();
    const { data, error } = await supabase
      .from("settings")
      .select("seen_guides")
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    if (data.seen_guides.includes(g)) return { ok: true };
    const res = await supabase
      .from("settings")
      .update({ seen_guides: [...data.seen_guides, g] })
      .eq("user_id", userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't save",
    };
  }
}

/** Remembers that the latest "What's new" was read. */
export async function markWhatsNewSeen(): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("settings")
      .update({ whats_new_seen: LATEST_RELEASE })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't save",
    };
  }
}

/** Shows every section guide again on the next visit. */
export async function resetGuides(): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("settings")
      .update({ seen_guides: [] })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't save",
    };
  }
}
