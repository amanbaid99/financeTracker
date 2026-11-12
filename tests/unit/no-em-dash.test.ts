import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP } from "@/lib/help";
import { GUIDES, RELEASES } from "@/lib/guides";
import { INTRO_TOUR } from "@/lib/tour";

// House style: no em dashes anywhere people read, in the UI, help, guides,
// docs or AI prompts. Use a comma, colon or full stop instead.
// (AGENTS.md is left out: next dev writes a block into it that we don't own.)
const ROOTS = ["app", "components", "lib", "docs", "public", "scripts", "supabase/migrations"];
const TEXT = /\.(tsx?|mjs|js|md|html|sql|py|json)$/;
const EM_DASH = "—";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : TEXT.test(p) ? [p] : [];
  });
}

describe("no em dashes", () => {
  it("in any source, doc or page", () => {
    const found = ROOTS.flatMap(files)
      .filter((p) => readFileSync(p, "utf8").includes(EM_DASH));
    expect(found).toEqual([]);
  });

  it("in help, guides, What's new and the tour", () => {
    const copy = JSON.stringify([HELP, GUIDES, RELEASES, INTRO_TOUR]);
    expect(copy.includes(EM_DASH)).toBe(false);
  });
});
