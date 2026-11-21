import type { PrepareResult } from "./actions";
import { formatINR } from "../format";
import { categoryLabel } from "../categories";
import { investedAfterWithdrawal } from "../withdrawal";
type Ready = Extract<PrepareResult, { ok: true }>;
export interface RowState {
  target: string;
  category: string | null;
  sip: number | null;
  goalId: string;
  matchAnswered: boolean;
  sipAnswered: boolean;
  withdrew?: boolean;
}

export interface Change {
  key: string;
  action: "update" | "add" | "skip";
  title: string;
  lines: string[];
  unchanged: boolean;
}

/** Plain list of what saving will do, for the confirm step. */
export function describeChanges(
  ready: Ready,
  state: Record<string, RowState>,
  { includeInvested = true }: { includeInvested?: boolean } = {},
): Change[] {
  const changes: Change[] = ready.rows.map((r) => {
    const s = state[r.key];
    if (s.target === "skip")
      return {
        key: r.key,
        action: "skip",
        title: r.name,
        lines: [],
        unchanged: true,
      };
    const goal = ready.goals.find((g) => g.id === s.goalId)?.name;
    if (s.target === "new") {
      const lines = [`Current amount ${formatINR(r.value)}`];
      lines.push(
        r.invested == null
          ? "Invested amount not provided by CAS"
          : `Invested amount ${formatINR(r.invested)}`,
      );
      if (s.sip) lines.push(`SIP ${formatINR(s.sip)} a month`);
      if (s.category) lines.push(categoryLabel(s.category));
      if (goal) lines.push(`Counts toward ${goal}`);
      return {
        key: r.key,
        action: "add",
        title: r.name,
        lines,
        unchanged: false,
      };
    }
    const inv = ready.investments.find((i) => i.id === s.target)!;
    const lines: string[] = [];
    if (inv.value !== r.value)
      lines.push(
        `Current amount ${formatINR(inv.value)} → ${formatINR(r.value)}`,
      );
    const invested =
      r.invested ??
      (s.withdrew && inv.invested != null
        ? investedAfterWithdrawal(inv.invested, inv.value, r.value)
        : inv.invested);
    if (invested != null && invested !== inv.invested)
      lines.push(
        `Invested amount ${inv.invested == null ? "not recorded" : formatINR(inv.invested)} → ${formatINR(invested)}${r.invested == null ? " (adjusted for withdrawal)" : ""}`,
      );
    if (s.sip !== null && s.sip !== inv.sip)
      lines.push(`SIP ${formatINR(inv.sip)} → ${formatINR(s.sip)} a month`);
    if (r.kind === "mutual_fund" && s.category && s.category !== inv.category) {
      lines.push(
        `Kind ${categoryLabel(inv.category)} → ${categoryLabel(s.category)}`,
      );
    }
    if (goal) lines.push(`Also counts toward ${goal}`);
    const unchanged = lines.length === 0;
    if (inv.value === r.value)
      lines.push(`Current amount ${formatINR(r.value)} (unchanged)`);
    if (invested === inv.invested) {
      lines.push(
        r.invested == null
          ? inv.invested == null
            ? "Invested amount not provided by CAS; still unknown"
            : `Invested amount ${formatINR(inv.invested)} kept; not provided by CAS`
          : `Invested amount ${formatINR(invested!)} (unchanged)`,
      );
    }
    return {
      key: r.key,
      action: "update",
      title: inv.name,
      lines,
      unchanged,
    };
  });
  return includeInvested ? changes : changes.map((c) => ({ ...c, lines: c.lines.filter((line) => !line.startsWith("Invested amount")) }));
}
