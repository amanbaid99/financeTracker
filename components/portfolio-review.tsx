"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runPortfolioReview, setPortfolioReviewsEnabled } from "@/lib/portfolio-review/actions";
import type { Finding, ReviewResult } from "@/lib/portfolio-review/checks";

/** Short headlines use the app's existing checked facts, never new calculations. */
function ReviewFinding({ finding: f }: { finding: Finding }) {
  const concentration = f.detail.match(/^(.*?) is (\d+%) of your portfolio\./);
  const nearTerm = f.detail.match(/^(.*?) has (\d+%) of its linked value/);
  const title = concentration ? `${concentration[1]}: ${concentration[2]} in one holding`
    : nearTerm ? `${nearTerm[1]}: money needed soon can fluctuate`
    : f.id.startsWith("shortfall:") ? f.detail : f.title;
  const takeaway = f.id.startsWith("concentration:") ? "Review where new contributions go."
    : f.id.startsWith("near-term:") ? "Review how this goal is funded."
    : f.id.startsWith("shortfall:") ? "Review this goal's saving plan."
    : f.id.startsWith("similar:") ? "Check whether these funds serve different goals."
    : "Check the holding categories.";
  return <li>
    <details className="group/finding">
      <summary className="cursor-pointer list-none py-2 [&::-webkit-details-marker]:hidden">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{takeaway} <span className="text-primary group-open/finding:hidden">Why?</span></span>
      </summary>
      <div className="space-y-2 pb-3 text-sm text-muted-foreground">
        <p>{f.detail}</p><p>{f.next}</p>
      </div>
    </details>
  </li>;
}

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
      <p className="text-sm text-muted-foreground">Full checks after CAS imports. Quick checks after balance updates.</p>
      <p className="text-xs text-muted-foreground">Only anonymous categories, rounded totals and calculated checks go to AI through OpenRouter. Names, account details and CAS documents stay out. Derived reviews are saved here. Nothing changes your investments.</p>
      {aiEnabled ? <Button size="sm" disabled={pending} onClick={() => act(() => setPortfolioReviewsEnabled(true))}>Turn on automatic reviews</Button> : <Link href="/ask" className="text-sm font-medium text-primary">Turn on AI in Ask to use reviews</Link>}
    </> : <>
      {checkedAt && <p className="text-xs text-muted-foreground">Checked {new Date(checkedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</p>}
      {!aiEnabled && <Link href="/ask" className="text-sm font-medium text-primary">Turn on AI in Ask to resume reviews</Link>}
      {timedOut && <p className="text-sm text-muted-foreground">The review did not finish. Try again below.</p>}
      {!waiting && result && <>
        {result.findings.length ? <>
          <ul className="divide-y">{result.findings.slice(0, 2).map(f => <ReviewFinding key={f.id} finding={f} />)}</ul>
          {result.findings.length > 2 && <details>
            <summary className="cursor-pointer py-1 text-sm font-medium text-primary">See {result.findings.length - 2} more {result.findings.length === 3 ? "check" : "checks"}</summary>
            <ul className="mt-2 divide-y">{result.findings.slice(2).map(f => <ReviewFinding key={f.id} finding={f} />)}</ul>
          </details>}
        </> : <p className="text-sm text-muted-foreground">No flags found. These checks do not cover every risk.</p>}
      </>}
      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button size="sm" variant="outline" disabled={pending || waiting || !aiEnabled} onClick={() => act(runPortfolioReview)}>Review again</Button>
        <details className="min-w-0 flex-1 text-xs text-muted-foreground open:basis-full">
          <summary className="cursor-pointer py-2 text-primary">Review details &amp; settings</summary>
          <div className="mt-2 space-y-3">
            {checkedAt && <p>Last check: {new Date(checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p>}
            {reviewedAt && <p>Last AI review: {new Date(reviewedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
            {result?.major.length ? <div><p className="font-medium">What changed</p><ul className="mt-1 list-disc space-y-1 pl-4">{result.major.map(change => <li key={change}>{change}</li>)}</ul></div> : null}
            <p>{result?.ai ? "AI prioritised checks calculated by the app." : "These are checks calculated by the app."} They do not inspect funds&apos; underlying investments or predict returns.</p>
            <p>Review new contributions first. Check taxes, exit loads and lock-ins before selling. Nothing changes your holdings or SIPs automatically.</p>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setPortfolioReviewsEnabled(false))}>Turn off reviews</Button>
          </div>
        </details>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <p className="text-xs text-muted-foreground">Not investment advice.</p>
      </div>
    </details>
  </section>;
}
