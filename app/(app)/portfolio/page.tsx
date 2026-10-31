import { PortfolioReview } from "@/components/portfolio-review";
import { resultSchema } from "@/lib/portfolio-review/checks";
import { aiAllowed } from "@/lib/portfolio-review/service";
import { requireUser } from "@/lib/data";
import { FileUp } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { AllocationBar } from "@/components/allocation-bar";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { UpdateButton } from "@/components/update-values";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGoals } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import { ASSET_CLASSES, buildPortfolio, swatchFor } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Portfolio" };

const pct = (n: number) => `${(n * 100).toFixed(Math.abs(n) < 0.1 ? 1 : 0)}%`;
const slotOf = (key: string) =>
  ASSET_CLASSES.find((c) => c.key === key)?.slot ?? 7;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ do?: string }>;
}) {
  const { do: action } = await searchParams;
  const { investments, links, goals } = await loadGoals();
  const { supabase, user } = await requireUser();
  const [review, aiEnabled] = await Promise.all([
    supabase
      .from("portfolio_reviews")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    aiAllowed(supabase, user.id),
  ]);
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
            holdings={[]}
            investments={investments}
            links={links}
          />
        </div>
      </main>
    );
  }

  const equity = p.classes.find((c) => c.key === "equity")?.share ?? 0;

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <GuideButton id="portfolio" />
        </div>
        <p className="text-sm text-muted-foreground">
          Everything you hold, across all your goals.
        </p>
      </div>
      {updatable.length > 0 && (
        <UpdateButton
          items={updatable}
          autoOpen={action === "update"}
          showButton={false}
        />
      )}

      <Card>
        <CardContent className="space-y-2 pt-5 sm:pt-5">
          <p className="text-xs text-muted-foreground">Total value</p>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatINR(p.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {p.monthlySips > 0
              ? `${formatINR(p.monthlySips)} a month going in · `
              : ""}
            {pct(equity)} in equity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where your money is</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationBar classes={p.classes} />
          <details className="mt-3 border-t pt-3">
            <summary className="cursor-pointer py-1 text-sm font-medium text-primary">
              By kind
            </summary>
            <ul className="mt-3 space-y-3 text-sm">
              {p.kinds.map((k) => (
                <li key={k.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{k.label}</span>
                    <span className="tabular shrink-0">
                      {formatINRCompact(k.value)}{" "}
                      <span className="text-muted-foreground">
                        · {pct(k.share)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn(
                        "h-full rounded-full",
                        swatchFor(slotOf(k.assetClass)),
                      )}
                      style={{ width: `${Math.max(k.share * 100, 1)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      {reviewCard}

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <PortfolioHoldings
            holdings={p.holdings}
            investments={investments}
            links={links}
          />
        </CardContent>
      </Card>
    </main>
  );
}
