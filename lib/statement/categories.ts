// Fund category from a scheme's name, by plain rules. Most Indian scheme
// names say what they are ("... Flexi Cap Fund", "... Liquid Fund"), so the
// AI check only runs for the names these rules can't place.

import type { Kind } from "@/lib/instruments";

export interface Placement {
  kind: Kind;
  category: string;
}

const EQUITY = new Set([
  "equity_index",
  "flexi_cap",
  "large_cap",
  "mid_small_cap",
  "elss",
  "sectoral_thematic",
  "international",
  "aggressive_hybrid",
  "balanced_advantage",
  "multi_asset",
]);
const DEBT = new Set([
  "liquid_fund",
  "overnight_fund",
  "ultra_short_debt",
  "short_debt_fund",
  "corporate_bond",
  "gilt",
  "debt_fund",
]);

// Order matters: the first match wins, so specific names come first.
const RULES: [RegExp, string][] = [
  [/\bgold\b/, "gold"],
  [/\bsilver\b/, "other"],
  [/\bliquid\b/, "liquid_fund"],
  [/\bovernight\b|\bmoney market\b/, "overnight_fund"],
  [/\barbitrage\b/, "arbitrage"],
  [/\belss\b|tax ?saver|long term equity/, "elss"],
  [/balanced advantage|dynamic asset allocation/, "balanced_advantage"],
  [/multi[ -]?asset/, "multi_asset"],
  [/aggressive hybrid|equity hybrid|hybrid equity/, "aggressive_hybrid"],
  [/conservative hybrid|regular savings|monthly income|equity savings/, "conservative_hybrid"],
  [/ultra short|low duration/, "ultra_short_debt"],
  [/corporate bond|banking (?:and|&) psu/, "corporate_bond"],
  [/\bgilt\b|constant maturity/, "gilt"],
  [/short duration|short term (?:debt|bond|fund|plan)/, "short_debt_fund"],
  [/credit risk|medium duration|medium to long|long duration|dynamic bond|floater|floating rate|\bincome\b|\bbond\b|\bdebt\b/, "debt_fund"],
  [/nasdaq|s&p 500|\bus\b|u\.s\.|global|international|overseas|\bworld\b|emerging market|greater china|\bjapan\b|\beurope\b/, "international"],
  [/\bindex\b|\bnifty\b|\bsensex\b|\betf\b/, "equity_index"],
  [/flexi ?cap|multi ?cap|\bfocused\b|large (?:&|and) mid|\bvalue\b|\bcontra\b|dividend yield/, "flexi_cap"],
  [/mid ?cap|small ?cap/, "mid_small_cap"],
  [/large ?cap|blue ?chip|top 100/, "large_cap"],
  [
    /banking|financial services|pharma|health ?care|technology|digital|\binfra|consumption|\bfmcg\b|\bpsu\b|energy|manufacturing|\bauto\b|defen[cs]e|business cycle|thematic|sector|\besg\b|\bmnc\b|commodit|realty|innovation/,
    "sectoral_thematic",
  ],
];

/** Kind and category from a scheme name; null when the rules can't tell. */
export function placeFromName(name: string, fundType: string | null = null): Placement | null {
  const n = ` ${name.toLowerCase().replace(/\s+/g, " ")} `;
  for (const [re, category] of RULES) {
    if (!re.test(n)) continue;
    if (category === "gold") return { kind: "gold", category: "gold" };
    // A category that contradicts the statement's own fund type is a guess.
    const t = (fundType ?? "").toUpperCase();
    if (t === "DEBT" && EQUITY.has(category)) return null;
    if (t === "EQUITY" && DEBT.has(category)) return null;
    return { kind: "mutual_fund", category };
  }
  return null;
}

/** Fixed placements for the rows the reader groups itself. */
export function placeFromKey(key: string): Placement | null {
  if (key === "DEMAT-STOCKS") return { kind: "stock", category: "direct_equity" };
  if (key === "DEMAT-BONDS") return { kind: "other", category: "other" };
  if (key === "NPS") return { kind: "nps", category: "nps" };
  return null;
}
