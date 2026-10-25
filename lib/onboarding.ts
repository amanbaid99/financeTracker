/** Every profile section with its title. Also used by the My details edit pages. */
export const STEPS = [
  { slug: "basics", title: "The basics", optional: false },
  { slug: "household", title: "Your household", optional: true },
  { slug: "income", title: "Your income", optional: false },
  { slug: "expenses", title: "Monthly essentials", optional: true },
  { slug: "insurance", title: "Insurance", optional: true },
  { slug: "liabilities", title: "Loans and cards", optional: true },
  { slug: "holdings", title: "Savings and investments", optional: true },
  { slug: "goals", title: "Goals", optional: true },
  { slug: "risk", title: "Risk comfort", optional: true },
  { slug: "finish", title: "Almost done", optional: false },
] as const;

export type StepSlug = (typeof STEPS)[number]["slug"];

/**
 * First-time onboarding asks only for the minimum. Everything else is added
 * later from the "Finish setting up" checklist on the home screen.
 */
export const ONBOARDING_FLOW: StepSlug[] = ["basics", "income", "finish"];

export function stepIndex(slug: string): number {
  return STEPS.findIndex((s) => s.slug === slug);
}

export function flowIndex(slug: string): number {
  return ONBOARDING_FLOW.indexOf(slug as StepSlug);
}

export function nextHref(slug: StepSlug, editing: boolean): string {
  const i = flowIndex(slug);
  if (editing || i === -1) return "/details";
  return i < ONBOARDING_FLOW.length - 1 ? `/onboarding/${ONBOARDING_FLOW[i + 1]}` : "/dashboard";
}

export function prevHref(slug: StepSlug, editing: boolean): string | null {
  const i = flowIndex(slug);
  if (editing || i === -1) return "/details";
  return i > 0 ? `/onboarding/${ONBOARDING_FLOW[i - 1]}` : null;
}
