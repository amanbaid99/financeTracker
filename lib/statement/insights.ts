// What changed with a statement import, in a few plain lines. Worked out by
// the app from the values you confirmed; no AI involved.

import { formatINR, formatINRCompact } from "../format";

export interface ImportedChange {
  name: string;
  /** Value before, or null for a new investment. */
  before: number | null;
  after: number;
  sipBefore: number | null;
  sipAfter: number | null;
  /** You said money was taken out. */
  withdrew: boolean;
  /** A new investment that isn't linked to any goal. */
  unlinked: boolean;
}

export interface Insight {
  title: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}

const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;

export function importInsights(changes: ImportedChange[]): Insight[] {
  const out: Insight[] = [];
  const updated = changes.filter((c) => c.before !== null);
  const added = changes.filter((c) => c.before === null);

  // Taken out: the whole drop on the funds you said you withdrew from.
  const out$ = updated.filter((c) => c.withdrew && c.after < c.before!);
  const withdrawn = out$.reduce((s, c) => s + (c.before! - c.after), 0);

  const before = updated.reduce((s, c) => s + c.before!, 0);
  const after = updated.reduce((s, c) => s + c.after, 0);
  if (updated.length && before > 0) {
    const growth = after - before + withdrawn;
    const base = before - withdrawn;
    out.push({
      title:
        growth >= 0
          ? `Up ${formatINRCompact(growth)} since your last update`
          : `Down ${formatINRCompact(-growth)} since your last update`,
      text: `${updated.length} investment${updated.length === 1 ? "" : "s"} now worth ${formatINR(after)}${
        withdrawn ? `, after taking out about ${formatINR(withdrawn)}` : ""
      }. That's ${pct(base > 0 ? growth / base : 0)} on what was there${
        withdrawn ? ", not counting the withdrawal" : ""
      }.`,
      tone: growth >= 0 ? "good" : "bad",
    });
  }
  if (withdrawn)
    out.push({
      title: `About ${formatINRCompact(withdrawn)} taken out`,
      text: `From ${out$.map((c) => c.name).join(", ")}. The amount invested went down by the same share, so gains stay right.`,
      tone: "neutral",
    });

  // Biggest moves, leaving out withdrawals.
  const moves = updated
    .filter((c) => !c.withdrew && c.before! > 0 && c.after !== c.before)
    .map((c) => ({ c, d: c.after - c.before!, r: (c.after - c.before!) / c.before! }));
  const up = [...moves].sort((a, b) => b.r - a.r)[0];
  const down = [...moves].sort((a, b) => a.r - b.r)[0];
  if (up && up.d > 0)
    out.push({
      title: `Best: ${up.c.name}`,
      text: `${formatINR(up.c.before!)} → ${formatINR(up.c.after)} (${pct(up.r)}).`,
      tone: "good",
    });
  if (down && down.d < 0 && down.r <= -0.03)
    out.push({
      title: `Fell most: ${down.c.name}`,
      text: `${formatINR(down.c.before!)} → ${formatINR(down.c.after)} (${pct(down.r)}). Markets move; this matters most for money you need soon.`,
      tone: "bad",
    });

  const sips = updated.filter(
    (c) => c.sipAfter !== null && c.sipBefore !== null && c.sipAfter !== c.sipBefore,
  );
  if (sips.length)
    out.push({
      title: "SIPs changed",
      text: sips
        .map((c) => `${c.name}: ${formatINR(c.sipBefore!)} → ${formatINR(c.sipAfter!)} a month`)
        .join("; "),
      tone: "neutral",
    });

  if (added.length) {
    const loose = added.filter((c) => c.unlinked);
    out.push({
      title: `${added.length} new investment${added.length === 1 ? "" : "s"}`,
      text: loose.length
        ? `${loose.map((c) => c.name).join(", ")} ${loose.length === 1 ? "isn't" : "aren't"} linked to a goal yet. Link ${loose.length === 1 ? "it" : "them"} from a goal so ${loose.length === 1 ? "it counts" : "they count"}.`
        : "Each one counts toward the goal you picked.",
      tone: "neutral",
    });
  }
  return out;
}
