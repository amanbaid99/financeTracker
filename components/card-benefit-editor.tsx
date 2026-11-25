"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { SPEND_CATEGORIES } from "@/lib/card-advisor";
import { PERIOD_LABELS } from "@/lib/cards";
import {
  type BenefitDraft,
  type RewardRule,
  type LoungeRule,
} from "@/lib/card-benefits";

function CashbackRate({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={draft ?? (value ? String(value / 100) : "")}
      onFocus={() => setDraft(value ? String(value / 100) : "")}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^\d{0,3}([.,]\d{0,2})?$/.test(next)) return;
        setDraft(next);
        onChange(Math.round(Number(next.replace(",", ".")) * 100));
      }}
    />
  );
}

/** Edits only a draft. Nothing here persists or implies verification. */
export function BenefitEditor({
  value,
  onChange,
}: {
  value: BenefitDraft;
  onChange: (v: BenefitDraft) => void;
}) {
  const reward = (i: number, patch: Partial<RewardRule>) =>
    onChange({
      ...value,
      rewardRules: value.rewardRules.map((r, n) =>
        n === i ? { ...r, ...patch } : r,
      ),
    });
  const lounge = (i: number, patch: Partial<LoungeRule>) =>
    onChange({
      ...value,
      lounges: value.lounges.map((r, n) => (n === i ? { ...r, ...patch } : r)),
    });
  return (
    <section
      className="space-y-4 border-t pt-4"
      aria-label="Review reward and lounge terms"
    >
      <div>
        <h3 className="font-semibold">Reward & lounge terms</h3>
        <p className="text-xs text-muted-foreground">
          Check against the brochure. Points, exclusions and other benefits can
          stay in the details.
        </p>
      </div>
      <Field label="Source">
        <Input
          aria-label="Benefit source"
          value={value.source}
          maxLength={200}
          onChange={(e) => onChange({ ...value, source: e.target.value })}
        />
      </Field>
      <Field label="Valid until (if stated)">
        <Input
          aria-label="Benefits valid until"
          type="date"
          value={value.validThrough ?? ""}
          onChange={(e) =>
            onChange({ ...value, validThrough: e.target.value || null })
          }
        />
      </Field>
      {value.rewardRules.map((r, i) => (
        <fieldset key={r.id} className="space-y-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">Cashback {i + 1}</legend>
          <Field label="Spending category">
            <Select
              aria-label={`Reward category ${i + 1}`}
              value={r.category}
              onChange={(e) =>
                reward(i, {
                  category: e.target.value as RewardRule["category"],
                })
              }
            >
              <option value="general">General spending</option>
              {Object.entries(SPEND_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cashback %">
              <CashbackRate
                label={`Cashback percent ${i + 1}`}
                value={r.cashbackBps}
                onChange={(v) => reward(i, { cashbackBps: v })}
              />
            </Field>
            <Field label="Reward cap (₹)">
              <MoneyInput
                aria-label={`Reward cap ${i + 1}`}
                value={r.cap}
                onChange={(v) => reward(i, { cap: v })}
              />
            </Field>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Excluded categories</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={`Reward excluded categories ${i + 1}`}
            >
              {Object.entries(SPEND_CATEGORIES).map(([key, label]) => {
                const category = key as NonNullable<
                  RewardRule["excludedCategories"]
                >[number];
                const selected =
                  r.excludedCategories?.includes(category) ?? false;
                return (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={selected}
                    className={`min-h-11 rounded-full border px-3 text-xs ${selected ? "bg-danger-soft text-danger" : "text-muted-foreground"}`}
                    onClick={() =>
                      reward(i, {
                        excludedCategories: selected
                          ? r.excludedCategories?.filter((c) => c !== category)
                          : [...(r.excludedCategories ?? []), category],
                      })
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Conditions, exclusions and cap period">
            <textarea
              aria-label={`Reward conditions ${i + 1}`}
              className="min-h-20 w-full rounded-lg border bg-card p-2 text-sm"
              maxLength={1200}
              value={r.conditions}
              onChange={(e) => reward(i, { conditions: e.target.value })}
            />
          </Field>
          <Field label="Supporting brochure quote">
            <textarea
              aria-label={`Reward evidence ${i + 1}`}
              className="min-h-16 w-full rounded-lg border bg-card p-2 text-sm"
              maxLength={1200}
              value={r.evidence}
              onChange={(e) => reward(i, { evidence: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange({
                ...value,
                rewardRules: value.rewardRules.filter((_, n) => n !== i),
              })
            }
          >
            Remove cashback rule
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.rewardRules.length >= 16}
        onClick={() =>
          onChange({
            ...value,
            rewardRules: [
              ...value.rewardRules,
              {
                id: crypto.randomUUID(),
                category: "general",
                cashbackBps: 100,
                cap: null,
                conditions: "",
                evidence: "",
              },
            ],
          })
        }
      >
        Add cashback rule
      </Button>
      {value.lounges.map((r, i) => (
        <fieldset key={r.id} className="space-y-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">
            Lounge benefit {i + 1}
          </legend>
          <Field label="Allowance name">
            <Input
              aria-label={`Lounge name ${i + 1}`}
              value={r.name}
              maxLength={100}
              onChange={(e) => lounge(i, { name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visits allowed">
              <Input
                aria-label={`Lounge allowance ${i + 1}`}
                type="number"
                min="1"
                max="999"
                value={r.visits || ""}
                onChange={(e) => lounge(i, { visits: Number(e.target.value) })}
              />
            </Field>
            <Field label="Resets">
              <Select
                aria-label={`Lounge reset ${i + 1}`}
                value={r.period}
                onChange={(e) =>
                  lounge(i, { period: e.target.value as LoungeRule["period"] })
                }
              >
                {["month", "quarter", "calendar_year", "card_year"].map((k) => (
                  <option key={k} value={k}>
                    {PERIOD_LABELS[k as LoungeRule["period"]]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Access conditions and guest rules">
            <textarea
              aria-label={`Lounge conditions ${i + 1}`}
              className="min-h-20 w-full rounded-lg border bg-card p-2 text-sm"
              maxLength={1200}
              value={r.conditions}
              onChange={(e) => lounge(i, { conditions: e.target.value })}
            />
          </Field>
          <Field label="Supporting brochure quote">
            <textarea
              aria-label={`Lounge evidence ${i + 1}`}
              className="min-h-16 w-full rounded-lg border bg-card p-2 text-sm"
              maxLength={1200}
              value={r.evidence}
              onChange={(e) => lounge(i, { evidence: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange({
                ...value,
                lounges: value.lounges.filter((_, n) => n !== i),
              })
            }
          >
            Remove lounge benefit
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.lounges.length >= 8}
        onClick={() =>
          onChange({
            ...value,
            lounges: [
              ...value.lounges,
              {
                id: crypto.randomUUID(),
                name: "Domestic lounges",
                visits: 1,
                period: "quarter",
                conditions: "",
                evidence: "",
              },
            ],
          })
        }
      >
        Add lounge benefit
      </Button>
      <Field label="Other terms and benefits">
        <textarea
          aria-label="Detailed card terms"
          className="min-h-28 w-full rounded-lg border bg-card p-2 text-sm"
          value={value.details}
          maxLength={16000}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
        />
      </Field>
    </section>
  );
}
