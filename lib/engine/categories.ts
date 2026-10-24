// Instrument categories the app can talk about. Category labels only: never
// fund, AMC or scheme names.

export interface HoldingCategory {
  value: string;
  label: string;
  liquid: boolean;
  equity: boolean;
}

export const HOLDING_CATEGORIES: HoldingCategory[] = [
  { value: "savings_account", label: "Savings account", liquid: true, equity: false },
  { value: "sweep_fd", label: "Sweep FD", liquid: true, equity: false },
  { value: "fd_rd", label: "FD / RD", liquid: true, equity: false },
  { value: "liquid_fund", label: "Liquid fund", liquid: true, equity: false },
  { value: "overnight_fund", label: "Overnight / money market fund", liquid: true, equity: false },
  { value: "ultra_short_debt", label: "Ultra-short duration fund", liquid: false, equity: false },
  { value: "short_debt_fund", label: "Short-duration debt fund", liquid: false, equity: false },
  { value: "corporate_bond", label: "Corporate bond / Banking & PSU fund", liquid: false, equity: false },
  { value: "gilt", label: "Gilt fund", liquid: false, equity: false },
  { value: "debt_fund", label: "Other debt fund", liquid: false, equity: false },
  { value: "arbitrage", label: "Arbitrage fund", liquid: false, equity: false },
  { value: "conservative_hybrid", label: "Conservative hybrid fund", liquid: false, equity: false },
  { value: "balanced_advantage", label: "Balanced advantage fund", liquid: false, equity: true },
  { value: "aggressive_hybrid", label: "Aggressive hybrid fund", liquid: false, equity: true },
  { value: "multi_asset", label: "Multi-asset allocation fund", liquid: false, equity: true },
  { value: "equity_index", label: "Equity index fund", liquid: false, equity: true },
  { value: "flexi_cap", label: "Flexi-cap fund", liquid: false, equity: true },
  { value: "large_cap", label: "Large-cap fund", liquid: false, equity: true },
  { value: "mid_small_cap", label: "Mid / small-cap fund", liquid: false, equity: true },
  { value: "elss", label: "ELSS (tax saver) fund", liquid: false, equity: true },
  { value: "sectoral_thematic", label: "Sectoral / thematic fund", liquid: false, equity: true },
  { value: "international", label: "International fund / FoF", liquid: false, equity: true },
  { value: "direct_equity", label: "Direct stocks", liquid: false, equity: true },
  { value: "ppf", label: "PPF", liquid: false, equity: false },
  { value: "epf_vpf", label: "EPF / VPF", liquid: false, equity: false },
  { value: "nps", label: "NPS", liquid: false, equity: true },
  { value: "gold", label: "Gold", liquid: false, equity: false },
  { value: "other", label: "Other", liquid: false, equity: false },
];

const byValue = new Map(HOLDING_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Uncategorised";
  return byValue.get(value)?.label ?? value;
}

/** Default category for a holding kind, used when the user does not pick one. */
export function defaultCategoryForKind(kind: string): string {
  switch (kind) {
    case "savings":
      return "savings_account";
    case "fd":
      return "fd_rd";
    case "ppf":
      return "ppf";
    case "epf":
      return "epf_vpf";
    case "nps":
      return "nps";
    case "stock":
      return "direct_equity";
    case "gold":
      return "gold";
    default:
      return "other";
  }
}

export function isLiquid(kind: string, category: string | null): boolean {
  if (kind === "savings" || kind === "fd") return true;
  const c = byValue.get(category ?? "");
  return c?.liquid ?? false;
}

export function isEquity(kind: string, category: string | null): boolean {
  if (kind === "stock") return true;
  const c = byValue.get(category ?? "");
  return c?.equity ?? false;
}
