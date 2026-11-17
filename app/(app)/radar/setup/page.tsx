import { BackLink } from "@/components/back-link";
import { radarInstruments } from "@/lib/radar/data";
export const metadata = { title: "Radar connection" };
export default async function RadarSetupPage() {
  const connection = await radarInstruments();
  return (
    <main className="space-y-5">
      <BackLink fallback="/radar" label="Radar" />
      <h1 className="text-2xl font-semibold">Connection and data checks</h1>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">INDmoney</h2>
        <p className="text-sm">
          {connection.ok
            ? "Instrument lookup is connected. Price-history access is checked when you refresh an instrument."
            : connection.error}
        </p>
        <p className="text-sm text-muted-foreground">
          Your API token stays in Vercel as INDSTOCKS_ACCESS_TOKEN. INDmoney
          tokens expire after 24 hours. Replace an expired token in Vercel and
          redeploy. Never paste it into chat or a watchlist field.
        </p>
        <p className="text-sm text-muted-foreground">
          The adapter reads instruments and daily market prices only. It does
          not call order, funds or portfolio endpoints.
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Before buying signals</h2>
        <ul className="list-disc pl-5 text-sm space-y-2 text-muted-foreground">
          <li>
            Confirm corporate-action adjustments and the exchange calendar,
            including holidays and special sessions.
          </li>
          <li>
            Verify stock fundamentals, sector support and historical valuations.
          </li>
          <li>
            Verify ETF NAV, spread and tracking data, plus underlying index
            valuations where needed.
          </li>
          <li>
            Define and validate the scoring models with reference tests and
            paper monitoring.
          </li>
        </ul>
        <p className="text-sm">
          Until these checks are complete, Radar shows Insufficient data and no
          opportunity score.
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          You can save thresholds now. Scheduled monitoring, Telegram linking
          and delivery are a later step. No messages are sent by this release.
        </p>
      </section>
    </main>
  );
}
