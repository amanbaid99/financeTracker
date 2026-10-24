"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveAllocations } from "@/lib/actions";

interface Alloc {
  goalId: string;
  percent: string;
}

/** Split one holding across goals by percent. The total can't pass 100%. */
export function AllocationEditor({
  holdingId,
  holdingLabel,
  goals,
  initial,
}: {
  holdingId: string;
  holdingLabel: string;
  goals: { id: string; name: string }[];
  initial: { goalId: string; percent: number }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Alloc[]>(initial.map((a) => ({ goalId: a.goalId, percent: String(a.percent) })));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const unused = goals.filter((g) => !rows.some((r) => r.goalId === g.id));

  function save() {
    setError("");
    setSaved(false);
    start(async () => {
      const res = await saveAllocations({
        holdingId,
        allocations: rows
          .filter((r) => r.goalId && Number(r.percent) > 0)
          .map((r) => ({ goalId: r.goalId, percent: Number(r.percent) })),
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  if (goals.length === 0) {
    return <p className="text-xs text-muted-foreground">Add a goal to link this holding to it.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            aria-label={`Goal for ${holdingLabel}`}
            className="flex-1"
            value={r.goalId}
            onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, goalId: e.target.value } : x)))}
          >
            {goals
              .filter((g) => g.id === r.goalId || unused.some((u) => u.id === g.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
          <div className="relative w-24 shrink-0">
            <Input
              aria-label={`Percent of ${holdingLabel}`}
              inputMode="decimal"
              className="pr-7"
              value={r.percent}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((x, k) => (k === i ? { ...x, percent: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) } : x)),
                )
              }
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove link"
            onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {unused.length > 0 && total < 100 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((rs) => [...rs, { goalId: unused[0].id, percent: String(Math.max(0, 100 - total)) }])
            }
          >
            <Plus /> Link a goal
          </Button>
        )}
        <Button type="button" size="sm" onClick={save} disabled={pending || total > 100}>
          {pending ? "Saving…" : "Save links"}
        </Button>
        <span className={`tabular text-xs ${total > 100 ? "text-danger" : "text-muted-foreground"}`}>
          {total > 100 ? `${total}%: can't go above 100%` : `${100 - total}% unassigned`}
        </span>
        {saved && <span className="text-xs text-success">Saved</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
