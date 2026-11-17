import { todayIST } from "@/lib/dates";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { RadarDetail } from "@/components/radar-detail";
import { classificationLabel } from "@/lib/radar/classification";
import { loadRadar, radarProvider } from "@/lib/radar/data";
export const metadata = { title: "Radar research" };
export default async function RadarInstrumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, data] = await Promise.all([params, loadRadar()]);
  const item = data.items.find((i) => i.id === id);
  if (!item) notFound();
  return (
    <main className="space-y-4">
      <BackLink fallback="/radar" label="Radar" />
      <div>
        <h1 className="text-2xl font-semibold break-words">{item.symbol}</h1>
        <p className="text-sm text-muted-foreground break-words">
          {item.name} · {item.exchange} · {classificationLabel(item.assetType, item.classification)}
        </p>
      </div>
      <RadarDetail
        key={item.id}
        item={item}
        snapshot={data.history.find((s) => s.watchId === item.id) ?? null}
        connected={!!radarProvider()}
        today={todayIST()}
        now={new Date().toISOString()}
      />
    </main>
  );
}
