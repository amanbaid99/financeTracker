"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBankAccount, updateBankBalance } from "@/lib/actions";

export function BankBalanceRow({ id, label, value }: { id: string; label: string; value: number }) {
  const router = useRouter();
  const [v, setV] = useState<number | null>(value);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const dirty = (v ?? 0) !== value;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-full truncate text-sm sm:w-auto sm:flex-1">{label}</span>
      <MoneyInput className="min-w-0 flex-1 sm:w-40 sm:flex-none" aria-label={`${label} balance`} value={v} onChange={setV} />
      <Button
        type="button"
        size="sm"
        variant={dirty ? "default" : "outline"}
        disabled={!dirty || pending}
        onClick={() =>
          start(async () => {
            const r = await updateBankBalance({ holdingId: id, value: v ?? 0 });
            setMsg(r.ok ? "Saved" : r.error);
            if (r.ok) router.refresh();
          })
        }
      >
        Update
      </Button>
      {msg && <span className="w-full text-right text-xs text-muted-foreground">{msg}</span>}
    </li>
  );
}

export function AddBankAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Add bank account
      </Button>
    );
  }
  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addBankAccount({ label, value: value ?? 0 });
          if (!r.ok) return setError(r.error);
          setOpen(false);
          setLabel("");
          setValue(null);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Account nickname"
          placeholder="Nickname, e.g. Salary account"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <MoneyInput aria-label="Current balance" value={value} onChange={setValue} />
      </div>
      <p className="text-xs text-muted-foreground">Never enter account numbers.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Add account
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
