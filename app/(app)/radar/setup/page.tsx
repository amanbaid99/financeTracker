import { BackLink } from "@/components/back-link";
import { radarInstruments } from "@/lib/radar/data";
export const metadata = { title: "Radar connection" };
export default async function RadarSetupPage() {
  const connection = await radarInstruments();
  return (
    <main className="space-y-5">
      <BackLink fallback="/radar" label="Radar" />
      <h1 className="text-2xl font-semibold">Connection and research checks</h1>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">INDmoney</h2>
        <p className="text-sm">
          {connection.ok
            ? "Instrument lookup is connected. Price and market-depth access are checked when you refresh research."
            : connection.error}
        </p>
        <p className="text-sm text-muted-foreground">
          Your token stays in Vercel as INDSTOCKS_ACCESS_TOKEN. INDmoney tokens
          expire after 24 hours. Replace an expired token in Vercel and
          redeploy. Never paste it into chat.
        </p>
        <p className="text-sm text-muted-foreground">
          The adapter only reads market instruments, prices and depth. AMFI
          supplies official NAV. No order, funds or broker portfolio endpoint is
          called.
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Automatic research</h2>
        <p className="text-sm">
          Open a watchlist item to see the evidence review. No price rules need
          enabling. Refresh research updates the saved inputs.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>
            ETF type is detected from the selected provider metadata or an exact
            AMFI ISIN match. Unclear types are flagged.
          </li>
          <li>
            Completed-session freshness is checked against the verified NSE and
            BSE calendars for the remainder of 2026.
          </li>
          <li>
            Official NAV is compared only with a closing price from the same
            session. A previous-day NAV is not a live fair value.
          </li>
          <li>
            Missing or unverified market timestamps cannot pass spread freshness
            checks, even when a quote was fetched recently.
          </li>
        </ul>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">What is still incomplete?</h2>
        <p className="text-sm text-muted-foreground">
          Verified price adjustments, ETF benchmark/tracking and underlying
          Gold/index context, stock fundamentals and validated research models
          are still needed for reliable Buy candidates. Hold or exit reviews
          also need ownership and portfolio context.
        </p>
        <p className="text-sm">
          Research can identify a verified reason to Wait, but it will show
          Insufficient data when it cannot support an investment conclusion.
          Missing inputs are not replaced with a forced recommendation.
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="font-semibold">Optional alerts</h2>
        <p className="text-sm text-muted-foreground">
          Manual entry and exit levels remain available under Optional price
          alerts. They are separate from research. Scheduled monitoring,
          Telegram delivery and backtesting are not enabled yet.
        </p>
      </section>
    </main>
  );
}
