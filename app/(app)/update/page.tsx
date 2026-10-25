import type { Metadata } from "next";
import { QuickUpdateForm, type QuickSections } from "@/components/forms/quick-update";
import { loadRaw } from "@/lib/data";
import { categoryLabel } from "@/lib/engine/categories";
import { formatDate } from "@/lib/format";
import { HOLDING_KIND_LABELS, LIABILITY_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Quick update" };

export default async function QuickUpdatePage() {
  const raw = await loadRaw();
  const lastUpdated = raw.holdings.reduce<string | null>(
    (latest, h) => (!latest || h.updated_at > latest ? h.updated_at : latest),
    null,
  );
  const sections: QuickSections = {
    banks: raw.holdings
      .filter((h) => h.kind === "savings")
      .map((h) => ({ id: h.id, label: h.name || "Bank account", value: h.current_value })),
    investments: raw.holdings
      .filter((h) => h.kind !== "savings")
      .map((h) => ({
        id: h.id,
        label: h.name || HOLDING_KIND_LABELS[h.kind],
        sub: categoryLabel(h.category),
        value: h.current_value,
      })),
    cards: raw.cards.map((c) => ({ id: c.id, label: c.label, value: c.outstanding })),
    loans: raw.liabilities.map((l) => ({
      id: l.id,
      label: l.label || LIABILITY_LABELS[l.kind],
      sub: l.emi ? `EMI ${l.emi.toLocaleString("en-IN")}` : undefined,
      value: l.outstanding,
    })),
    goals: raw.goals.map((g) => ({ id: g.id, label: g.name, value: g.saved_amount })),
  };
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Quick update</h1>
        <p className="text-sm text-muted-foreground">
          Refresh your balances in one go, then save. A good habit once a month, or after payday.
          {lastUpdated ? ` Last updated ${formatDate(lastUpdated.slice(0, 10))}.` : ""}
        </p>
      </div>
      <QuickUpdateForm sections={sections} />
    </main>
  );
}
