import type { Milestone } from "./cards";

/** Describe the reward being tracked, without claiming the bank granted it. */
export function milestoneLabel(
  milestone: Pick<Milestone, "name" | "reward">,
): string {
  const raw = milestone.reward?.trim() || milestone.name.trim();
  const label = /^annual\s+fee\s+waived[.!]?$/i.test(raw)
    ? "Annual fee waiver"
    : raw;
  return label.replace(/\b(\d{4,})(?=\s+(?:bonus\s+)?points?\b)/gi, (value) =>
    new Intl.NumberFormat("en-IN").format(Number(value)),
  );
}
