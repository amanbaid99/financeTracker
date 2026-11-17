import { todayIST } from "@/lib/dates";
import { GuideButton } from "@/components/guides";
import { RadarWorkspace } from "@/components/radar-workspace";
import { loadRadar, radarInstruments } from "@/lib/radar/data";
export const metadata = { title: "Investment Radar" };
export default async function RadarPage() {
  const [data, connection] = await Promise.all([
    loadRadar(),
    radarInstruments(),
  ]);
  return (
    <main className="space-y-5">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Investment Radar
          </h1>
          <GuideButton id="radar" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Your research watchlist, separate from your portfolio.
        </p>
      </div>
      <RadarWorkspace
        today={todayIST()}
        now={new Date().toISOString()}
        items={data.items}
        snapshots={data.history.map((s) => ({
          watchId: s.watchId,
          analysis: s.analysis,
        }))}
        connection={connection.ok ? { ok: true } : connection}
      />
    </main>
  );
}
