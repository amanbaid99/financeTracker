import {
  emptyBenefits,
  preserveLoungeIds,
  type BenefitDraft,
} from "./card-benefits";
import type { Card, Milestone, Period } from "./cards";
import type { Review } from "./card-extract";
export interface SetupMilestone {
  key: string;
  id: string | null;
  name: string;
  target: number;
  period: Period;
  deadline: string | null;
  reward: string | null;
}
export interface CardSetupDraft {
  label: string;
  annualFee: number | null;
  yearStart: string | null;
  statementDay: number | null;
  features: BenefitDraft;
  milestones: SetupMilestone[];
}
export function cardSetupDraft(
  card: Card | null,
  review: Review | undefined,
  newId: () => string,
): CardSetupDraft {
  const features = review?.featureDraft
    ? preserveLoungeIds(review.featureDraft, card?.featureDetails, newId)
    : { ...(card?.featureDetails ?? emptyBenefits()) };
  if (review) {
    features.details = [
      features.details,
      ...review.benefits
        .filter((b) => b.check === "confirmed")
        .map((b) => b.value),
      review.rewards?.value,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 16000);
  }
  if (!card?.featureDetails && !review?.featureDraft) {
    features.source = "Entered by you";
    features.details = [
      features.details,
      card?.rewards,
      ...(card?.benefits ?? []),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 16000);
  }
  const milestones: SetupMilestone[] = (card?.milestones ?? []).map((m) => ({
    key: m.id,
    id: m.id,
    name: m.name,
    target: m.target,
    period: m.period,
    deadline: m.deadline,
    reward: m.reward,
  }));
  for (const m of review?.milestones ?? []) {
    if (
      !milestones.some(
        (x) => x.target === m.value.target && x.period === m.value.period,
      )
    ) {
      milestones.push({ key: newId(), id: null, ...m.value, deadline: null });
    }
  }
  return {
    label: card?.label ?? review?.cardName?.value ?? "",
    annualFee: review?.annualFee?.value ?? card?.annualFee ?? null,
    yearStart: card?.yearStart ?? null,
    statementDay: card?.statementDay ?? null,
    features,
    milestones,
  };
}
export function changedMilestones(
  draft: SetupMilestone[],
  existing: Milestone[],
): SetupMilestone[] {
  return draft.filter((m) => {
    const old = existing.find((x) => x.id === m.id);
    return (
      !old ||
      old.name !== m.name ||
      old.target !== m.target ||
      old.period !== m.period ||
      old.deadline !== m.deadline ||
      old.reward !== m.reward
    );
  });
}
