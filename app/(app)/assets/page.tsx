// Hidden for now with the AI portfolio review (see below).
// import { PortfolioReview } from "@/components/portfolio-review";
// import { resultSchema } from "@/lib/portfolio-review/checks";
import { FileUp } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { UpdateButton } from "@/components/update-values";
import { buttonVariants } from "@/components/ui/button";
import { loadBudget, loadGoals, loadLoans, loadCurrentNetWorth, loadSnapshot } from "@/lib/data";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { moneyFlow } from "@/lib/money-flow";
import { MoneyFlowStats } from "@/components/money-flow";
import { OweList } from "@/components/owe-list";
import { NetWorthCard } from "@/components/net-worth-card";
// import { AI_CONSENT_VERSION } from "@/lib/legal";
import { buildPortfolio } from "@/lib/portfolio";
import {UnallocatedMoney} from "@/components/unallocated-money";
import { SimplifyCard } from "@/components/simplify-card";
import { cueCategory } from "@/lib/home-cues";
import { simplifyHints } from "@/lib/simplify";

export const metadata: Metadata = { title: "Net worth" };

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ do?: string;category?:string }>;
}) {
  const { do: action,category } = await searchParams;
  const initialCategory=action==="add"?cueCategory(category):null;
  // One snapshot for everything here (shared with the layout).
  const [{ investments, links, goals, today, allocation }, snap, worth, loans, b] =
    await Promise.all([
      loadGoals(),
      loadSnapshot(),
      loadCurrentNetWorth(),
      loadLoans(),
      loadBudget(),
    ]);
  const sheet = await loadBudgetSheet(b.budget.income || b.recordIncome, b.loanEmis);
  const importHistory = { data: snap.settings, error: null };
  // The AI portfolio review is hidden for now. To bring it back, uncomment
  // this (and the imports above) and pass review={reviewCard} below.
  // const review = { data: snap.review, error: null };
  // const aiEnabled = Boolean(
  //   snap.profile?.ai_enabled &&
  //     snap.ai_consent?.granted &&
  //     snap.ai_consent.version === AI_CONSENT_VERSION,
  // );
  // const parsedReview = resultSchema.safeParse(review.data?.result);
  // const reviewCard = (
  //   <PortfolioReview
  //     available={!review.error}
  //     enabled={review.data?.enabled ?? false}
  //     aiEnabled={aiEnabled}
  //     state={review.data?.state ?? "idle"}
  //     checkedAt={review.data?.checked_at ?? null}
  //     reviewedAt={review.data?.reviewed_at ?? null}
  //     result={parsedReview.success ? parsedReview.data : null}
  //   />
  // );
  const p = buildPortfolio(investments);
  const flow = moneyFlow(sheet.plan, sheet.saved, p.monthlySips);
  const goalNames = new Map(goals.map((g) => [g.id, g.name]));
  // Every investment, with the goals it counts toward (if any).
  const updatable = investments.map((i) => ({
    investment: i,
    goals: links
      .filter((l) => l.investmentId === i.id)
      .map((l) => goalNames.get(l.goalId) ?? ""),
  }));

  if (p.holdings.length === 0) {
    return (
      <main className="space-y-5">
        {updatable.length > 0 && (
          <UpdateButton
            items={updatable}
            autoOpen={action === "update"}
            showButton={false}
            />
        )}
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Net worth</h1>
          <GuideButton id="portfolio" />
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">
            Import a CAS statement, or add your investments and savings, to see
            everything you hold in one place.
          </p>
          <Link href="/import?from=portfolio" className={buttonVariants()}>
            <FileUp /> Import a CAS statement
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <PortfolioHoldings
            autoAdd={action === "add"}
          initialCategory={initialCategory}
            holdings={[]}
            investments={investments}
            links={links}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Net worth</h1>
          <GuideButton id="portfolio" />
        </div>
      </div>
      {updatable.length > 0 && (
        <UpdateButton
          items={updatable}
          autoOpen={action === "update"}
            showButton={false}
        />
      )}

      <MoneyFlowStats flow={flow} />
      <NetWorthCard history={[{ day: today, ...worth }]} />
      <OweList loans={loans} today={today} />
      <section aria-labelledby="own-h" className="space-y-2">
      <h2 id="own-h" className="px-0.5 text-lg font-semibold">What you own</h2>
      <PortfolioOverview
        portfolio={p}
        investments={investments}
        links={links}
        review={null}
        lastImportAt={
          importHistory.error
            ? null
            : (importHistory.data?.last_cas_import_at ?? null)
        }
        autoAdd={action === "add"}
          initialCategory={initialCategory}
      />
      </section>
      <UnallocatedMoney investments={investments} links={links} goals={goals} today={today}/>
      <SimplifyCard hints={simplifyHints(investments, allocation).filter(h=>h.id!=="spare")} />
    </main>
  );
}
