import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BasicsForm } from "@/components/forms/basics-form";
import { ExpensesForm } from "@/components/forms/expenses-form";
import { FinishForm } from "@/components/forms/finish-form";
import { GoalForm } from "@/components/forms/goal-form";
import { GOAL_TYPE_LABELS } from "@/lib/labels";
import { GoalsStep } from "@/components/forms/goals-step";
import { HoldingsForm } from "@/components/forms/holdings-form";
import { HouseholdForm } from "@/components/forms/household-form";
import { IncomeForm } from "@/components/forms/income-form";
import { InsuranceForm } from "@/components/forms/insurance-form";
import { LiabilitiesForm } from "@/components/forms/liabilities-form";
import { RiskForm } from "@/components/forms/risk-form";
import { Progress } from "@/components/ui/progress";
import { aiConfigured } from "@/lib/ai/config";
import { loadAnalysis } from "@/lib/data";
import { suggestRetirement } from "@/lib/engine/goals";
import type { GoalType } from "@/lib/engine/types";
import {
  expenseState,
  goalState,
  holdingState,
  incomeState,
  insuranceState,
  liabilityState,
} from "@/lib/form-state";
import { nextHref, prevHref, STEPS, stepIndex, type StepSlug } from "@/lib/onboarding";
import { asAccent, asTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Set up" };

const INTRO: Record<StepSlug, string> = {
  basics: "A few details to get started. Only your name, age and at least one income are required.",
  household: "Who depends on your income changes how big your safety net should be.",
  income: "Your plan is built on the money you can count on every month.",
  expenses: "Your essentials set the size of your emergency fund. Skip this and we'll estimate half your income.",
  insurance: "Cover comes before investing, so one hospital bill can't undo years of saving.",
  liabilities: "Costly debt is paid off before you invest.",
  holdings: "What you already have counts toward your safety net and goals.",
  goals: "Goals give your savings a job to do.",
  risk: "Three quick questions so long-term goals use a mix you're comfortable with.",
  finish: "One last thing before your plan.",
};

export default async function StepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ edit?: string; add?: string }>;
}) {
  const { step } = await params;
  const sp = await searchParams;
  const index = stepIndex(step);
  if (index === -1) notFound();
  const slug = step as StepSlug;
  const meta = STEPS[index];
  const { raw, analysis, data, today } = await loadAnalysis();
  const editing = sp.edit === "1" || Boolean(raw.profile.onboarding_completed_at);
  const next = nextHref(slug, editing);
  const back = prevHref(slug, editing);
  const answered = (s: string) => raw.profile.answered_sections.includes(s);

  let body: React.ReactNode;
  switch (slug) {
    case "basics":
      body = (
        <BasicsForm
          editing={editing}
          next={next}
          back={back}
          initial={{
            name: raw.profile.name,
            age: data.profile.age,
            cityTier: raw.profile.city_tier,
            theme: asTheme(raw.profile.theme),
            accent: asAccent(raw.profile.accent),
          }}
        />
      );
      break;
    case "household":
      body = (
        <HouseholdForm
          editing={editing}
          next={next}
          back={back}
          initial={{
            maritalStatus: raw.profile.marital_status,
            dependents: raw.profile.dependents,
            soleEarner: raw.profile.sole_earner,
          }}
        />
      );
      break;
    case "income":
      body = <IncomeForm editing={editing} next={next} back={back} initial={incomeState(raw, today)} />;
      break;
    case "expenses":
      body = <ExpensesForm editing={editing} next={next} back={back} initial={expenseState(raw)} />;
      break;
    case "insurance":
      body = (
        <InsuranceForm
          editing={editing}
          next={next}
          back={back}
          initial={insuranceState(raw)}
          answered={answered("insurance")}
        />
      );
      break;
    case "liabilities":
      body = (
        <LiabilitiesForm
          editing={editing}
          next={next}
          back={back}
          initial={liabilityState(raw)}
          answered={answered("liabilities")}
        />
      );
      break;
    case "holdings":
      body = (
        <HoldingsForm
          editing={editing}
          next={next}
          back={back}
          initial={holdingState(raw)}
          answered={answered("holdings")}
          goals={raw.goals.map((g) => ({ id: g.id, name: g.name }))}
          defaultReturns={analysis.config.goals.returnByCategory}
        />
      );
      break;
    case "goals": {
      if (sp.add) {
        const type = (sp.add in GOAL_TYPE_LABELS ? sp.add : "custom") as GoalType;
        const initial = goalState(null, today, type);
        if (type === "retirement") {
          const s = suggestRetirement(analysis.budget.essentials.total * 12, data.profile.age, today, analysis.config);
          initial.targetToday = s.targetToday || null;
          if (s.targetDate) initial.targetDate = s.targetDate;
          initial.name = "Retirement";
        }
        body = (
          <GoalForm
            initial={initial}
            defaultInflation={analysis.config.goals.inflationByType}
            afterSave="/onboarding/goals"
            cancelHref="/onboarding/goals"
          />
        );
      } else {
        body = (
          <GoalsStep
            next={next}
            back={back}
            retirement={suggestRetirement(analysis.budget.essentials.total * 12, data.profile.age, today, analysis.config)}
            goals={raw.goals.map((g) => ({
              id: g.id,
              name: g.name,
              type: g.type,
              targetToday: g.target_today,
              targetDate: g.target_date,
            }))}
          />
        );
      }
      break;
    }
    case "risk":
      body = <RiskForm editing={editing} next={next} back={back} />;
      break;
    case "finish":
      body = <FinishForm back={back} aiAvailable={aiConfigured()} />;
      break;
  }

  return (
    <main className="space-y-6">
      {!editing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Step {index + 1} of {STEPS.length}
            {meta.optional ? " · optional" : ""}
          </p>
          <Progress value={((index + 1) / STEPS.length) * 100} label="Onboarding progress" />
        </div>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{INTRO[slug]}</p>
      </div>
      {body}
    </main>
  );
}
