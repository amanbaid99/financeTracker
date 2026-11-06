import { PortfolioReview } from "@/components/portfolio-review";
import { resultSchema } from "@/lib/portfolio-review/checks";
import { FileUp } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { UpdateButton } from "@/components/update-values";
import { buttonVariants } from "@/components/ui/button";
import { loadGoals, loadSnapshot } from "@/lib/data";
import { AI_CONSENT_VERSION } from "@/lib/legal";
import { buildPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ do?: string }>;
}) {
  const { do: action } = await searchParams;
  // One snapshot for everything here (shared with the layout).
  const [{ investments, links, goals }, snap] = await Promise.all([
    loadGoals(),
    loadSnapshot(),
  ]);
  const review = { data: snap.review, error: null };
  const aiEnabled = Boolean(
    snap.profile?.ai_enabled &&
      snap.ai_consent?.granted &&
      snap.ai_consent.version === AI_CONSENT_VERSION,
  );
  const importHistory = { data: snap.settings, error: null };
  const parsedReview = resultSchema.safeParse(review.data?.result);
  const reviewCard = (
    <PortfolioReview
      available={!review.error}
      enabled={review.data?.enabled ?? false}
      aiEnabled={aiEnabled}
      state={review.data?.state ?? "idle"}
      checkedAt={review.data?.checked_at ?? null}
      reviewedAt={review.data?.reviewed_at ?? null}
      result={parsedReview.success ? parsedReview.data : null}
    />
  );
  const p = buildPortfolio(investments);
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
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
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
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
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

      <PortfolioOverview
        portfolio={p}
        investments={investments}
        links={links}
        review={reviewCard}
        lastImportAt={
          importHistory.error
            ? null
            : (importHistory.data?.last_cas_import_at ?? null)
        }
        autoAdd={action === "add"}
      />
    </main>
  );
}
