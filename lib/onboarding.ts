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

export function stepIndex(slug: string): number {
  return STEPS.findIndex((s) => s.slug === slug);
}

export function nextHref(slug: StepSlug, editing: boolean): string {
  if (editing) return "/settings";
  const i = stepIndex(slug);
  return i >= 0 && i < STEPS.length - 1 ? `/onboarding/${STEPS[i + 1].slug}` : "/dashboard";
}

export function prevHref(slug: StepSlug, editing: boolean): string | null {
  if (editing) return "/settings";
  const i = stepIndex(slug);
  return i > 0 ? `/onboarding/${STEPS[i - 1].slug}` : null;
}
