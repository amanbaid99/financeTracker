import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { SimpleSipPlanner } from "@/components/simple-sip-planner";
import { loadGoals } from "@/lib/data";
import { loadHybridContext } from "@/lib/hybrid-data";

export const metadata: Metadata = { title: "Your monthly SIPs" };
export default async function BudgetSipPage() {
  const [d, c] = await Promise.all([loadGoals(), loadHybridContext()]);
  const prior = c.plans[0]?.inputs as
    | {
        budgetSource?: string;
        contributionStartMonth?: string;
        monthlySavings?: number;
        allocationMode?: "safety_deadline";
        monthlyPlanLimit?: number;
        overrides?: Record<string, number>;
        vehicleOverrides?: import("@/lib/sip-worksheet").VehicleOverrides;
      }
    | undefined;
  const initialMonthly =
    prior?.monthlyPlanLimit ?? prior?.monthlySavings ?? d.plan?.monthly ?? null;
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Your monthly SIPs</h1>
        <p className="text-sm text-muted-foreground">
          Emergency cover first, then your nearest goals. Review the monthly
          amounts and save once.
        </p>
      </div>
      <SimpleSipPlanner
        goals={d.goals}
        investments={d.investments}
        links={d.links}
        today={d.today}
        initialMonthly={
          prior?.allocationMode === "safety_deadline"
            ? (prior.monthlyPlanLimit ?? initialMonthly)
            : initialMonthly
        }
        initialOverrides={
          prior?.allocationMode === "safety_deadline"
            ? (prior.overrides ?? {})
            : {}
        }
        initialVehicleOverrides={prior?.vehicleOverrides ?? {}}
        initialStartMonth={prior?.contributionStartMonth}
        revision={c.revision}
        riskTolerance={c.riskTolerance}
      />
    </main>
  );
}
