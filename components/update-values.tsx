"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { investmentTitle } from "@/components/investment-sheet";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { updateValues } from "@/lib/actions";
import { clearParam } from "@/lib/clear-param";
import { useQuickAction } from "@/components/quick-add";
import { formatINR } from "@/lib/format";
import type { Investment } from "@/lib/tracker";
import { cn } from "@/lib/utils";

export interface UpdateItem {
  investment: Investment;
  /** Names of the goals it counts toward. */
  goals: string[];
}

/** Button that opens one panel to type in today's value of every investment. */
export function UpdateButton({
  items,
  autoOpen = false,
}: {
  items: UpdateItem[];
  /** Open straight away (from the + menu). */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const close = useCallback(() => {
    setOpen(false);
    clearParam("do");
  }, []);
  useQuickAction(
    "update",
    useCallback(() => setOpen(true), []),
  );
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <RefreshCw /> Update
      </Button>
      {open && <UpdateSheet items={items} onClose={close} />}
    </>
  );
}

function UpdateSheet({
  items,
  onClose,
}: {
  items: UpdateItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(items.map((x) => [x.investment.id, x.investment.value])),
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const changed = items.filter(
    (x) => (values[x.investment.id] ?? 0) !== x.investment.value,
  );

  function save() {
    setError("");
    start(async () => {
      const res = await updateValues(
        changed.map((x) => ({
          id: x.investment.id,
          value: values[x.investment.id] ?? 0,
        })),
      );
      if (!res.ok) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Sheet title="Update amounts" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed.length) save();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Type in what each investment is worth today.
        </p>
        <ul className="divide-y">
          {items.map(({ investment: i, goals }) => {
            const title = investmentTitle(i);
            const dirty = (values[i.id] ?? 0) !== i.value;
            return (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dirty ? `Was ${formatINR(i.value)}` : goals.join(", ")}
                  </p>
                </div>
                <MoneyInput
                  className={cn(
                    "w-36 shrink-0",
                    dirty && "[&_input]:border-primary",
                  )}
                  aria-label={`${title} value today`}
                  value={values[i.id] ?? null}
                  onChange={(v) => setValues((s) => ({ ...s, [i.id]: v }))}
                />
              </li>
            );
          })}
        </ul>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 border-t bg-card px-5 pt-3">
          <Button
            type="submit"
            className="w-full"
            disabled={pending || changed.length === 0}
          >
            {pending
              ? "Saving…"
              : changed.length
                ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`
                : "Change an amount to save"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
