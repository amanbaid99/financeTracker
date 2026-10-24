// Every threshold, percentage and planning return used by the engine lives here.
// Per-user overrides (settings.config_overrides) are deep-merged on top via mergeConfig.

export type HorizonBandKey =
  | "under_1y"
  | "1_to_3y"
  | "3_to_5y"
  | "5_to_7y"
  | "7y_plus";

export interface HorizonBand {
  key: HorizonBandKey;
  label: string;
  /** Upper bound in years (exclusive). The last band uses Infinity. */
  maxYears: number;
  categories: string[];
  /** Planning return per year, as a percentage (e.g. 6 = 6%). */
  returnPct: number;
}

export const defaultConfig = {
  budget: {
    /** Savings target floor as a share of base income. */
    savingsMinPct: 0.2,
    /** Essentials + savings may never exceed this share of base income. */
    essentialsPlusSavingsCapPct: 0.9,
    /** Used when no expenses have been entered. */
    essentialsFallbackPct: 0.5,
    variableSurplus: { ladder: 0.5, goals: 0.3, wants: 0.2 },
    /** Secondary job income. ladderGoals is split evenly between ladder and goals. */
    secondarySurplus: { ladderGoals: 0.7, wants: 0.3 },
    bonusSurplus: { ladder: 0.5, goals: 0.3, wants: 0.2 },
    freelance: {
      taxReservePct: 0.25,
      payYourselfLowestN: 3,
      historyMonths: 6,
      bufferTargetMonths: 3,
    },
    /** Advance tax due dates (month is 1-12), shown to freelancers and business owners. */
    advanceTaxDates: [
      { month: 6, day: 15 },
      { month: 9, day: 15 },
      { month: 12, day: 15 },
      { month: 3, day: 15 },
    ],
  },
  ladder: {
    starterBufferMonths: 1,
    healthCoverMetro: 1_000_000,
    healthCoverOther: 500_000,
    termIncomeMultiple: 15,
    /** Fixed term cover target in rupees. 0 means use the income multiple. */
    termCoverTarget: 0,
    highInterestThresholdPct: 10,
    /**
     * Which costly debt gets extra money first: "snowball" (smallest balance)
     * or "avalanche" (highest rate).
     */
    debtMethod: "snowball" as "snowball" | "avalanche",
    /** True: goals get their monthly amounts first, extra debt payments use what's left. */
    debtAfterGoals: true,
    /** Rates assumed when none is entered (% a year). */
    assumedDebtRates: { credit_card: 36, personal_loan: 14 } as Record<string, number>,
    /** Minimum payment on a card with no EMI entered, as a share of the balance. */
    cardMinPaymentPct: 0.05,
    /** Debt kinds treated as high interest when no rate is entered. */
    assumeHighInterestKinds: ["credit_card", "personal_loan"],
    emergencyMonths: {
      stableNoDependents: 3,
      stableWithDependents: 6,
      variableSalary: 6,
      multipleJobs: 4,
      freelanceOrBusiness: 9,
      soleEarnerWithDependents: 9,
      freelanceAndSoleEarnerWithDependents: 12,
    },
    /** Months we aim to finish a money step in, used to size the savings target. */
    targetMonthsToComplete: 12,
    retirementBaselinePct: 0.1,
  },
  goals: {
    horizonBands: [
      {
        key: "under_1y",
        label: "Under 1 year",
        maxYears: 1,
        categories: ["Savings account", "Sweep FD", "Liquid fund"],
        returnPct: 6,
      },
      {
        key: "1_to_3y",
        label: "1 to 3 years",
        maxYears: 3,
        categories: ["FD / RD", "Short-duration debt fund"],
        returnPct: 6.5,
      },
      {
        key: "3_to_5y",
        label: "3 to 5 years",
        maxYears: 5,
        categories: ["Conservative hybrid fund", "Balanced advantage fund", "Debt fund"],
        returnPct: 8,
      },
      {
        key: "5_to_7y",
        label: "5 to 7 years",
        maxYears: 7,
        categories: ["Equity index fund", "Flexi-cap fund", "Debt fund (about 60:40 equity to debt)"],
        returnPct: 9.5,
      },
      {
        key: "7y_plus",
        label: "7+ years",
        maxYears: Infinity,
        categories: ["Equity index fund", "Flexi-cap fund"],
        returnPct: 11,
      },
    ] as HorizonBand[],
    retirementExtraCategories: ["PPF", "NPS", "EPF / VPF"],
    /** Inflation per goal type, percentage per year. */
    inflationByType: {
      emergency_fund: 6,
      insurance_premium_fund: 6,
      wedding: 7,
      house_down_payment: 7,
      vehicle: 6,
      education: 10,
      travel: 6,
      retirement: 6,
      medical: 10,
      custom: 6,
    } as Record<string, number>,
    defaultInflationPct: 6,
    glidePathYears: 3,
    /**
     * Long-run planning returns (% a year) per holding category. Conservative
     * assumptions, not live market data. Users can override per holding.
     */
    returnByCategory: {
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
    } as Record<string, number>,
    /** Goal amounts (future target, projection, suggestions) round to this many rupees. */
    roundTo: 10_000,
    /** Return assumed for money saved directly on a goal with no deadline. */
    openGoalSavedReturnPct: 7,
    /** How far ahead to look when estimating a goal with no deadline. */
    openGoalMaxYears: 50,
    /** Horizon used for the "to get there in N years" hint on open goals. */
    openGoalHintYears: 5,
    /** Yearly step-up used to suggest a lower starting SIP on each goal. */
    suggestedStepUpPct: 10,
    status: { onTrack: 1, slightlyBehind: 0.8 },
    retirementAge: 60,
    /** Retirement corpus suggestion, in today's rupees: this many years of annual essentials. */
    retirementCorpusYears: 25,
  },
  completeness: {
    weights: {
      income: 25,
      expenses: 20,
      insurance: 15,
      liabilities: 15,
      holdings: 15,
      household: 5,
      risk: 5,
    },
  },
};

export type EngineConfig = typeof defaultConfig;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type ConfigOverrides = DeepPartial<EngineConfig>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override) || !isPlainObject(base)) {
    return (override === undefined ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null) continue;
    const current = out[k];
    // Arrays and primitives replace; objects merge. Types must match to avoid
    // a bad override (e.g. a string for a number) breaking the engine.
    if (isPlainObject(current)) {
      out[k] = deepMerge(current, v);
    } else if (Array.isArray(current)) {
      if (Array.isArray(v)) out[k] = v;
    } else if (current === undefined || typeof current === typeof v) {
      out[k] = v;
    }
  }
  return out as T;
}

export function mergeConfig(overrides?: unknown): EngineConfig {
  const merged = deepMerge(defaultConfig, overrides ?? {});
  // Infinity does not survive JSON, so make sure the last band is open ended.
  const bands = merged.goals.horizonBands;
  if (bands.length > 0) {
    bands[bands.length - 1] = { ...bands[bands.length - 1], maxYears: Infinity };
  }
  return merged;
}
