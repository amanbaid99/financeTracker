"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runPortfolioReview, setPortfolioReviewsEnabled } from "@/lib/portfolio-review/actions";
import type { ReviewResult } from "@/lib/portfolio-review/checks";

export function PortfolioReview({ available, enabled, aiEnabled, state, checkedAt, reviewedAt, result }: {
  available: boolean; enabled: boolean; aiEnabled: boolean; state: string;
  checkedAt: string | null; reviewedAt: string | null; result: ReviewResult | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  const timedOut = expiredAt !== null && expiredAt === checkedAt;
  useEffect(() => {
    if (state !== "pending") return;
    const started = checkedAt ? new Date(checkedAt).getTime() : Date.now();
    const poll = () => {
      if (Date.now() - started > 180_000) { setExpiredAt(checkedAt); return; }
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [state, checkedAt, router]);
  const act = (action: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setError(""); setExpiredAt(null);
    const response = await action();
    if (!response.ok) setError(response.error ?? "Try again in a moment.");
    router.refresh();
  });
  const waiting = state === "pending" && !timedOut;
  const summary = !available ? "Reviews are unavailable" : !enabled ? "Automatic reviews are off" : !aiEnabled ? "AI is off" : waiting ? "Review in progress" : timedOut ? "Review did not finish" : state === "basic" ? "No major change since your last review" : state === "ready" ? result?.findings.length ? `${result.findings.length} ${result.findings.length === 1 ? "check" : "checks"} to review` : "No flags in these checks" : state === "limited" ? "Basic checks ready. AI limit reached" : "AI unavailable. Basic checks only";
  return <section className="rounded-2xl border bg-card" aria-labelledby="portfolio-review-h">
    <h2 id="portfolio-review-h" className="sr-only">Portfolio review</h2>
    <details className="group/review">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl p-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Portfolio review</span>
          <span role="status" className="block text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-primary"><span className="group-open/review:hidden">View review</span><span className="hidden group-open/review:inline">Hide review</span></span>
      </summary>
      <div className="space-y-3 border-t p-4">
    {!available ? <p className="text-sm text-muted-foreground">Automatic reviews are not available yet. Your holdings are saved as usual.</p> : !enabled ? <>
      <p className="text-sm text-muted-foreground">Get a full review after each confirmed CAS import. Other holding updates get a quick check, with AI used when something major changes.</p>
      <p className="text-xs text-muted-foreground">Only anonymous categories, rounded totals and calculated checks go to AI through OpenRouter. Names, account details and CAS documents stay out. Derived reviews are saved here. Nothing changes your investments.</p>
      {aiEnabled ? <Button size="sm" disabled={pending} onClick={() => act(() => setPortfolioReviewsEnabled(true))}>Turn on automatic reviews</Button> : <Link href="/ask" className="text-sm font-medium text-primary">Turn on AI in Ask to use reviews</Link>}
    </> : <>
      <p className="text-sm text-muted-foreground">
        {!aiEnabled ? "AI is off. Turn it on in Ask to resume automatic reviews." : waiting ? "Reviewing your updated portfolio. You can carry on using the app." : timedOut ? "The review did not finish. You can try again." : state === "basic" ? "Quick check complete. No major change since the last AI review." : state === "ready" ? "Review complete. Here is what deserves a closer look." : state === "limited" ? "Basic checks are ready. Today's AI review limit has been reached." : "AI review is unavailable. Any basic checks below still apply."}
      </p>
      {checkedAt && <p className="text-xs text-muted-foreground">Last check: {new Date(checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST{reviewedAt && state === "basic" ? `. Last AI review: ${new Date(reviewedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}.` : ""}</p>}
      {!waiting && result && <>
        {result.major.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 text-primary">What changed</summary><ul className="list-disc space-y-1 pl-4">{result.major.map(change => <li key={change}>{change}</li>)}</ul></details>}
        {result.findings.length ? <ul className="space-y-3">{result.findings.slice(0, 3).map(f => <li key={f.id} className="space-y-1 text-sm"><p className="font-medium">{f.title}</p><p className="text-muted-foreground">{f.detail}</p><p>{f.next}</p></li>)}</ul> : <p className="text-sm">No flags in these checks. This is not a guarantee that the portfolio suits your needs.</p>}
        {result.findings.length > 3 && <details><summary className="cursor-pointer text-sm text-primary">See all {result.findings.length} checks</summary><ul className="mt-3 space-y-3">{result.findings.slice(3).map(f => <li key={f.id} className="space-y-1 text-sm"><p className="font-medium">{f.title}</p><p className="text-muted-foreground">{f.detail}</p><p>{f.next}</p></li>)}</ul></details>}
        <p className="text-xs text-muted-foreground">{result.ai ? "AI prioritised checks calculated by the app." : "These are checks calculated by the app."} This does not inspect funds&apos; underlying investments or predict returns.</p>
      </>}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 text-primary">About rebalancing</summary><p className="mt-1">Start by reviewing where new monthly investments go. These checks flag concentration and money needed soon. They do not set a target allocation from your age. A target needs your goals, cash needs and risk comfort. Review taxes, exit loads and lock-ins before selling. No trades or SIP changes happen automatically.</p></details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending || waiting || !aiEnabled} onClick={() => act(runPortfolioReview)}>Review again</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setPortfolioReviewsEnabled(false))}>Turn off reviews</Button>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <p className="text-xs text-muted-foreground">Not investment advice.</p>
      </div>
    </details>
  </section>;
}
