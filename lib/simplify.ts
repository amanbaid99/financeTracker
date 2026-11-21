// Ways to make your portfolio simpler: funds doing the same job, tiny
// holdings, and money no goal needs. Read-only hints; nothing is sold or
// moved. Names only your own holdings, never new funds.

import type { AutoAllocation, Pool } from "./auto-allocate";
import { POOL_LABEL } from "./auto-allocate";
import { categoryLabel } from "./categories";
import { formatINR } from "./format";
import { asKind, KIND_LABELS } from "./instruments";
import type { Investment } from "./tracker";

export interface SimplifyHint {
  id: string;
  title: string;
  text: string;
}

const title = (i: Investment) =>
  i.name?.trim() ||
  (i.kind === "mutual_fund"
    ? categoryLabel(i.category)
    : KIND_LABELS[asKind(i.kind)]);

/** Fund types where one or two is plenty. */
const SAFE = new Set(["liquid_fund", "overnight_fund", "money_market"]);
/** More than this many funds of one type is usually doing the same job. */
const SAME_TYPE_LIMIT = 2;
/** Holdings under this share of the total and this amount count as tiny. */
const TINY_SHARE = 0.01;
const TINY_AMOUNT = 20000;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function simplifyHints(
  investments: Investment[],
  allocation: Pick<AutoAllocation, "spare" | "spareTotal">,
): SimplifyHint[] {
  const hints: SimplifyHint[] = [];
  const funds = investments.filter(
    (i) => i.kind === "mutual_fund" && i.value > 0 && i.category,
  );
  const total = investments.reduce((s, i) => s + Math.max(0, i.value), 0);

  const accounts=investments.filter(i=>i.kind==="savings");
  if(accounts.length>2)hints.push({id:"bank-accounts",title:`${accounts.length} bank accounts to review`,text:`Give each account a clear job, such as salary, bills or a backup. Consider closing an extra account only after checking salary credits, EMIs, UPI, autopay, linked investments, fees and minimum-balance rules. A low balance alone does not mean an account is unused.`});

  // Several funds of the same type.
  const byType = new Map<string, Investment[]>();
  for (const f of funds)
    byType.set(f.category!, [...(byType.get(f.category!) ?? []), f]);
  for (const [cat, list] of byType) {
    const limit = SAFE.has(cat) ? 1 : SAME_TYPE_LIMIT;
    if (list.length <= limit) continue;
    const sorted = [...list].sort((a, b) => b.value - a.value);
    const keep = sorted.slice(0, limit);
    const move = sorted.slice(limit);
    const label = categoryLabel(cat).toLowerCase();
    hints.push({
      id: `type-${cat}`,
      title: `${plural(list.length, label)}`,
      text: `They do the same job. You could move ${move.map(title).join(", ")} (${formatINR(move.reduce((s, i) => s + i.value, 0))}) into ${keep.map(title).join(" or ")}.`,
    });
  }

  // Tiny holdings with no SIP going in.
  const tiny = investments.filter(
    (i) =>
      (i.kind === "mutual_fund" || i.kind === "stock") &&
      i.value > 0 &&
      i.monthlySip <= 0 &&
      i.value < TINY_AMOUNT &&
      total > 0 &&
      i.value / total < TINY_SHARE,
  );
  if (tiny.length >= 2)
    hints.push({
      id: "tiny",
      title: `${plural(tiny.length, "small holding")}`,
      text: `${tiny.map(title).join(", ")} add up to ${formatINR(tiny.reduce((s, i) => s + i.value, 0))}. Moving them into a fund you already use means fewer things to track.`,
    });

  // Money no goal needs right now.
  if (allocation.spareTotal > 0) {
    const pools = (Object.keys(allocation.spare) as Pool[])
      .filter((p) => (allocation.spare[p] ?? 0) > 0)
      .sort((a, b) => (allocation.spare[b] ?? 0) - (allocation.spare[a] ?? 0));
    const cash = allocation.spare.cash ?? 0;
    hints.push({
      id: "spare",
      title: `${formatINR(allocation.spareTotal)} not needed by any goal`,
      text:
        cash >= 50000 && cash >= allocation.spareTotal * 0.95
          ? "It's all safe money that no goal due soon needs. It's free for a new goal; for goals 3 or more years away, equity usually suits better."
          : `Mostly ${POOL_LABEL[pools[0]]}. It's free for a new goal, or to give a goal more room.` +
            (cash >= 50000
              ? ` ${formatINR(cash)} of it is safe money no goal due soon needs; for goals 3 or more years away, equity usually suits better.`
              : ""),
    });
  }
  return hints.slice(0,3);
}
