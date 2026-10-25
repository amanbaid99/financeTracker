// Investment types the user can attach to a goal, and the planning return each
// one assumes by default. Category labels only: never fund, AMC or scheme names.

import { defaultCategoryForKind, HOLDING_CATEGORIES } from "./categories";

export const KINDS = ["mutual_fund", "stock", "fd", "ppf", "epf", "nps", "gold", "savings", "other"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABELS: Record<Kind, string> = {
  mutual_fund: "Mutual fund",
  stock: "Stocks",
  fd: "FD / RD",
  ppf: "PPF",
  epf: "EPF / VPF",
  nps: "NPS",
  gold: "Gold",
  savings: "Savings account",
  other: "Other",
};

const NOT_FUNDS = new Set(["savings_account", "sweep_fd", "fd_rd", "direct_equity", "ppf", "epf_vpf", "nps", "gold"]);

/** Mutual fund categories to pick from. */
export const FUND_CATEGORIES = HOLDING_CATEGORIES.filter((c) => !NOT_FUNDS.has(c.value));

/** Conservative long-run planning returns, % a year. Not live market data. */
export const RETURN_BY_CATEGORY: Record<string, number> = {
  savings_account: 3,
  sweep_fd: 6.5,
  fd_rd: 7,
  liquid_fund: 6.5,
  overnight_fund: 6.5,
  ultra_short_debt: 7,
  short_debt_fund: 7,
  corporate_bond: 7.5,
  gilt: 7.5,
  debt_fund: 7,
  arbitrage: 6.5,
  conservative_hybrid: 8,
  balanced_advantage: 9,
  aggressive_hybrid: 10.5,
  multi_asset: 10,
  equity_index: 11,
  flexi_cap: 11.5,
  large_cap: 11,
  mid_small_cap: 13,
  elss: 11.5,
  sectoral_thematic: 12,
  international: 10,
  direct_equity: 12,
  ppf: 7.1,
  epf_vpf: 8.25,
  nps: 10,
  gold: 8,
  other: 7,
};

/** Category stored for an investment: the fund category for mutual funds, else one per type. */
export function categoryFor(kind: Kind, fundCategory: string | null): string {
  if (kind === "mutual_fund") return fundCategory || "other";
  return defaultCategoryForKind(kind);
}

export function defaultReturn(kind: string, category: string | null): number {
  const c = category ?? defaultCategoryForKind(kind);
  return RETURN_BY_CATEGORY[c] ?? RETURN_BY_CATEGORY.other;
}

export function asKind(v: string): Kind {
  return (KINDS as readonly string[]).includes(v) ? (v as Kind) : "other";
}
