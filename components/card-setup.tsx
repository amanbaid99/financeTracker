"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import {
  benefitDraftSchema,
  rewardLabel,
  rewardValueLabel,
  PAYMENT_CHANNELS,
  type RewardRule,
  type LoungeRule,
} from "@/lib/card-benefits";
import {
  cardSetupDraft,
  changedMilestones,
  type SetupMilestone,
} from "@/lib/card-setup";
import { PERIOD_LABELS, type Card, type Period } from "@/lib/cards";
import type { Review } from "@/lib/card-extract";
import {
  saveCard,
  saveMilestone,
  deleteMilestone,
  deleteCard,
} from "@/lib/cards-actions";
import { formatINR } from "@/lib/format";

function NumberEntry({
  label,
  value,
  onChange,
  decimal = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  decimal?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      value={text ?? (value === null ? "" : String(value))}
      onFocus={() => setText(value === null ? "" : String(value))}
      onBlur={() => setText(null)}
      onChange={(e) => {
        const next = e.target.value;
        if (!(decimal ? /^\d{0,9}([.,]\d{0,2})?$/ : /^\d{0,9}$/).test(next))
          return;
        setText(next);
        onChange(next === "" ? null : Number(next.replace(",", ".")));
      }}
    />
  );
}
function MerchantListInput({
  value,
  onChange,
  label,
}: {
  value: string[] | undefined;
  onChange: (v: string[] | undefined) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      value={draft ?? value?.join(", ") ?? ""}
      onFocus={() => setDraft(value?.join(", ") ?? "")}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(
          e.target.value
            ? e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : undefined,
        );
      }}
    />
  );
}
export function CardSetupForm({
  card,
  initialReview,
  onSaved,
  onClose,
  onRead,
  initialStep = 0,
}: {
  card: Card | null;
  initialReview?: Review;
  onSaved: (id?: string) => void;
  onClose: () => void;
  onRead?: () => void;
  initialStep?: 0 | 1 | 2 | 3;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() =>
    cardSetupDraft(card, initialReview, () => crypto.randomUUID()),
  );
  const [editingRule, setEditingRule] = useState<string | null>(() =>
    draft.features.rewardRules.length === 1
      ? draft.features.rewardRules[0].id
      : null,
  );
  const [step, setStep] = useState<number>(initialStep);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createId] = useState(() => crypto.randomUUID());
  const savedCard = useRef<string | null>(card?.id ?? null);
  const savedMilestones = useRef(new Map<string, string>());
  const deleted = useRef(new Set<string>());
  const patch = (v: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...v }));
  const features = (v: Partial<typeof draft.features>) =>
    setDraft((d) => ({ ...d, features: { ...d.features, ...v } }));
  const updateRule = (i: number, v: Partial<RewardRule>) =>
    features({
      rewardRules: draft.features.rewardRules.map((r, n) =>
        n === i ? { ...r, ...v } : r,
      ),
    });
  const updateLounge = (i: number, v: Partial<LoungeRule>) =>
    features({
      lounges: draft.features.lounges.map((r, n) =>
        n === i ? { ...r, ...v } : r,
      ),
    });
  const milestone = (i: number, v: Partial<SetupMilestone>) =>
    patch({
      milestones: draft.milestones.map((m, n) =>
        n === i ? { ...m, ...v } : m,
      ),
    });
  const addRule = (points = false) => {
    const id = crypto.randomUUID();
    setEditingRule(id);
    features({
      rewardRules: [
        ...draft.features.rewardRules,
        {
          id,
          category: draft.features.rewardRules.length ? "online" : "general",
          cashbackBps: 0,
          cap: null,
          conditions: "",
          evidence: "Entered and confirmed by you",
          ...(points
            ? {
                points: {
                  perSpend: 0,
                  spend: 0,
                  valuePaise: null,
                  cap: null,
                  redemption: "",
                },
              }
            : {}),
        },
      ],
    });
  };
  const validate = () => {
    if (!draft.label.trim()) return "Enter the card name.";
    if (
      draft.statementDay !== null &&
      (draft.statementDay < 1 || draft.statementDay > 31)
    )
      return "Statement day must be from 1 to 31.";
    if (step >= 1) {
      const parsed = benefitDraftSchema.safeParse(draft.features);
      if (!parsed.success)
        return `Check your rewards or benefits: ${parsed.error.issues[0].message}`;
    }
    if (
      step >= 2 &&
      draft.milestones.some(
        (m) =>
          !m.name.trim() ||
          m.target <= 0 ||
          (m.period === "once" && !m.deadline),
      )
    )
      return "Add a name, spend target and any required deadline for each milestone.";
    return "";
  };
  const next = () => {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };
  const save = () =>
    start(async () => {
      const issue = validate();
      if (issue) {
        setError(issue);
        return;
      }
      setError("");
      try {
        const res = await saveCard({
          id: savedCard.current,
          ...(!savedCard.current ? { createId } : {}),
          label: draft.label,
          annualFee: draft.annualFee,
          statementDay: draft.statementDay,
          yearStart: draft.yearStart,
          rewards: draft.features.rewardRules.length
            ? draft.features.rewardRules
                .map(rewardLabel)
                .join("; ")
                .slice(0, 200)
            : (card?.rewards ?? initialReview?.rewards?.value ?? null),
          benefits: card?.benefits ?? [],
          bestFor: (card?.bestFor as SpendCategory[]) ?? [],
          reviewedBenefits: draft.features,
          humanConfirmed: true,
        });
        if (!res.ok || !res.id) {
          setError(res.ok ? "Couldn't save the card." : res.error);
          return;
        }
        savedCard.current = res.id;
        for (const m of changedMilestones(
          draft.milestones,
          card?.milestones ?? [],
        )) {
          const r = await saveMilestone({
            id: m.id ?? savedMilestones.current.get(m.key) ?? null,
            cardId: res.id,
            ...(!m.id ? { createId: m.key } : {}),
            name: m.name,
            target: m.target,
            period: m.period,
            deadline: m.deadline,
            reward: m.reward,
          });
          if (!r.ok) {
            setError(
              `Card saved. Couldn't finish milestones: ${r.error} Retry to finish.`,
            );
            return;
          }
          if (r.id) savedMilestones.current.set(m.key, r.id);
        }
        const keep = new Set(
          draft.milestones
            .map((m) => m.id ?? savedMilestones.current.get(m.key))
            .filter(Boolean),
        );
        for (const id of [
          ...(card?.milestones.map((m) => m.id) ?? []),
          ...savedMilestones.current.values(),
        ]) {
          if (keep.has(id) || deleted.current.has(id)) continue;
          const r = await deleteMilestone(id);
          if (!r.ok) {
            setError(`Card saved. Couldn't remove a milestone: ${r.error}`);
            return;
          }
          deleted.current.add(id);
        }
        router.refresh();
        onSaved(res.id);
        onClose();
      } catch {
        setError(
          "Couldn't finish saving. Your answers are still here. Retry to finish.",
        );
      }
    });
  const titles = [
    "Which card do you have?",
    "How does it reward you?",
    "Any extra benefits?",
    "Your card, at a glance",
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Step {step + 1} of 4</p>
        <div className="mt-2 flex gap-1" aria-label={`Step ${step + 1} of 4`}>
          {titles.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <h2 className="mt-4 text-xl font-semibold">{titles[step]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 3
            ? "Save confirms these terms. Nothing changes until you confirm."
            : "Skip anything you don't know. You can update it later."}
        </p>
      </div>
      {initialReview && step === 0 && (
        <p className="rounded-xl bg-primary-soft p-3 text-sm">
          Prefilled from your document or text. Check the answers, conditions
          and other benefits before saving.
        </p>
      )}
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {step === 0 && (
          <>
            {onRead && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onRead}
              >
                Fill this in from PDF or text
              </Button>
            )}
            <Field
              label="Card name"
              htmlFor="setup-name"
              hint="Bank and exact card variant. Never enter the number."
            >
              <Input
                id="setup-name"
                value={draft.label}
                maxLength={40}
                onChange={(e) => patch({ label: e.target.value })}
              />
            </Field>
            <Field
              label="Annual fee (₹)"
              hint="Leave blank if unknown. Enter 0 if free."
            >
              <MoneyInput
                aria-label="Annual fee"
                value={draft.annualFee}
                onChange={(v) => patch({ annualFee: v })}
              />
            </Field>
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm text-primary">
                Card year & statement reminders
              </summary>
              <div className="mt-3 space-y-3">
                <Field
                  label="Card year starts"
                  hint="Used for annual benefits and milestones."
                >
                  <Input
                    aria-label="Card year starts"
                    type="date"
                    value={draft.yearStart ?? ""}
                    onChange={(e) =>
                      patch({ yearStart: e.target.value || null })
                    }
                  />
                </Field>
                <Field
                  label="Statement day"
                  hint="Optional, day 1 to 31. Leave blank to turn reminders off."
                >
                  <Input
                    aria-label="Statement day"
                    inputMode="numeric"
                    value={draft.statementDay ?? ""}
                    onChange={(e) => {
                      const n = e.target.value;
                      if (/^\d{0,2}$/.test(n))
                        patch({ statementDay: n ? Number(n) : null });
                    }}
                  />
                </Field>
              </div>
            </details>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-xs text-muted-foreground">
              Add a category rate for fuel, bills, UPI or international
              spending. These can have different eligibility.
            </p>
            {onRead && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onRead}
              >
                Fill from PDF or text
              </Button>
            )}
            {!draft.features.rewardRules.length && (
              <div className="space-y-3">
                <p className="text-sm">Cashback, points, or not sure yet?</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addRule()}
                  >
                    Cashback
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addRule(true)}
                  >
                    Points
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Not sure? Continue without adding a rate.
                </p>
              </div>
            )}
            {draft.features.rewardRules.map((r, i) => (
              <section
                key={r.id}
                className="space-y-3 rounded-xl border p-3"
                aria-label={`Reward rule ${i + 1}`}
              >
                <button
                  type="button"
                  aria-label={`Edit reward rate ${i + 1}`}
                  aria-expanded={editingRule === r.id}
                  className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
                  onClick={() =>
                    setEditingRule(editingRule === r.id ? null : r.id)
                  }
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {r.points
                        ? r.points.perSpend
                          ? rewardLabel(r)
                          : "Points rate"
                        : r.cashbackBps
                          ? rewardLabel(r)
                          : "Cashback rate"}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {r.merchants?.length
                        ? "Partner stores"
                        : r.channel
                          ? PAYMENT_CHANNELS[r.channel]
                          : r.category !== "general"
                            ? SPEND_CATEGORIES[r.category]
                            : "General eligible spending"}
                      {r.eligibleCategories?.length &&
                      r.eligibleCategories.length <= 2
                        ? ` · ${r.eligibleCategories.map((c) => SPEND_CATEGORIES[c]).join(", ")}`
                        : ""}
                      {r.cap !== null ? ` · cap ${formatINR(r.cap)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-primary">
                    {editingRule === r.id ? "Done" : "Edit"}
                  </span>
                </button>
                {editingRule === r.id && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Spending category">
                        <Select
                          aria-label={`Reward category ${i + 1}`}
                          value={r.category}
                          onChange={(e) =>
                            updateRule(i, {
                              category: e.target
                                .value as RewardRule["category"],
                              eligibleCategories: undefined,
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
                      <Field label="Reward type">
                        <Select
                          aria-label={`Reward type ${i + 1}`}
                          value={r.points ? "points" : "cashback"}
                          onChange={(e) =>
                            updateRule(
                              i,
                              e.target.value === "points"
                                ? {
                                    cashbackBps: 0,
                                    cap: null,
                                    points: {
                                      perSpend: 0,
                                      spend: 0,
                                      valuePaise: null,
                                      cap: null,
                                      redemption: "",
                                    },
                                  }
                                : {
                                    points: undefined,
                                    cashbackBps: 0,
                                    cap: null,
                                  },
                            )
                          }
                        >
                          <option value="cashback">Cashback</option>
                          <option value="points">Points</option>
                        </Select>
                      </Field>
                    </div>
                    {r.points ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Points earned">
                            <NumberEntry
                              label={`Points earned ${i + 1}`}
                              value={r.points.perSpend || null}
                              onChange={(v) =>
                                updateRule(i, {
                                  points: { ...r.points!, perSpend: v ?? 0 },
                                })
                              }
                            />
                          </Field>
                          <Field label="For every ₹ spent">
                            <MoneyInput
                              aria-label={`Points spend step ${i + 1}`}
                              value={r.points.spend || null}
                              onChange={(v) =>
                                updateRule(i, {
                                  points: { ...r.points!, spend: v ?? 0 },
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Field
                          label="1 point is worth ₹"
                          hint="Leave blank if unknown. We won't guess its value."
                        >
                          <NumberEntry
                            decimal
                            label={`Point value ${i + 1}`}
                            value={
                              r.points.valuePaise === null
                                ? null
                                : r.points.valuePaise / 100
                            }
                            onChange={(v) =>
                              updateRule(i, {
                                points: {
                                  ...r.points!,
                                  valuePaise:
                                    v === null ? null : Math.round(v * 100),
                                },
                              })
                            }
                          />
                        </Field>
                        <Field
                          label="When redeemed for"
                          hint="For example, statement credit or a specific travel redemption."
                        >
                          <Input
                            aria-label={`Point redemption ${i + 1}`}
                            maxLength={200}
                            value={r.points.redemption}
                            onChange={(e) =>
                              updateRule(i, {
                                points: {
                                  ...r.points!,
                                  redemption: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label="Maximum points earned (optional)">
                          <NumberEntry
                            label={`Points cap ${i + 1}`}
                            value={r.points.cap}
                            onChange={(v) =>
                              updateRule(i, {
                                points: { ...r.points!, cap: v },
                              })
                            }
                          />
                        </Field>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Cashback %">
                          <NumberEntry
                            decimal
                            label={`Cashback percent ${i + 1}`}
                            value={r.cashbackBps ? r.cashbackBps / 100 : null}
                            onChange={(v) =>
                              updateRule(i, {
                                cashbackBps: Math.round((v ?? 0) * 100),
                              })
                            }
                          />
                        </Field>
                        <Field label="Maximum cashback ₹" hint="Optional">
                          <MoneyInput
                            aria-label={`Reward cap ${i + 1}`}
                            value={r.cap}
                            onChange={(v) => updateRule(i, { cap: v })}
                          />
                        </Field>
                      </div>
                    )}
                    {(r.cap !== null ||
                      (r.points?.cap !== null &&
                        r.points?.cap !== undefined)) && (
                      <Field label="Cap resets">
                        <Select
                          aria-label={`Reward cap period ${i + 1}`}
                          value={r.capPeriod ?? ""}
                          onChange={(e) =>
                            updateRule(i, {
                              capPeriod: (e.target.value ||
                                undefined) as RewardRule["capPeriod"],
                            })
                          }
                        >
                          <option value="">Not sure yet</option>
                          {[
                            "month",
                            "quarter",
                            "calendar_year",
                            "card_year",
                          ].map((k) => (
                            <option key={k} value={k}>
                              {PERIOD_LABELS[k as keyof typeof PERIOD_LABELS]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    <details className="text-sm">
                      <summary className="min-h-11 cursor-pointer py-3 text-primary">
                        Where this rate applies
                      </summary>
                      <div className="space-y-3 pt-2">
                        <Field label="Payment method">
                          <Select
                            aria-label={`Reward payment method ${i + 1}`}
                            value={r.channel ?? ""}
                            onChange={(e) =>
                              updateRule(i, {
                                channel: (e.target.value ||
                                  undefined) as RewardRule["channel"],
                              })
                            }
                          >
                            <option value="">Any eligible method</option>
                            {Object.entries(PAYMENT_CHANNELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field
                          label="Only these stores / apps"
                          hint="Comma-separated. Leave blank for any eligible store."
                        >
                          <MerchantListInput
                            label={`Reward merchants ${i + 1}`}
                            value={r.merchants}
                            onChange={(v) => updateRule(i, { merchants: v })}
                          />
                        </Field>
                        {!!r.eligibleCategories?.length && (
                          <p className="text-xs text-muted-foreground">
                            Shared rate and cap for:{" "}
                            {r.eligibleCategories
                              .map((c) => SPEND_CATEGORIES[c])
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer py-2 text-sm text-primary">
                        Conditions & excluded spends
                      </summary>
                      <div className="space-y-3 pt-2">
                        {r.points && (
                          <Field
                            label="Cash redemption cap ₹ (optional)"
                            hint="Only if the issuer limits the cash value, separately from the points earned."
                          >
                            <MoneyInput
                              aria-label={`Points cash-value cap ${i + 1}`}
                              value={r.cap}
                              onChange={(v) => updateRule(i, { cap: v })}
                            />
                          </Field>
                        )}
                        <Input
                          aria-label={`Reward conditions ${i + 1}`}
                          value={r.conditions}
                          maxLength={1200}
                          placeholder="Eligible merchants, minimum spend, exclusions…"
                          onChange={(e) =>
                            updateRule(i, { conditions: e.target.value })
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(SPEND_CATEGORIES).map(
                            ([k, label]) => {
                              const key = k as SpendCategory,
                                on = r.excludedCategories?.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-label={`Exclude ${label} from rule ${i + 1}`}
                                  aria-pressed={!!on}
                                  className={`min-h-11 rounded-full border px-3 text-xs ${on ? "bg-danger-soft text-danger" : "text-muted-foreground"}`}
                                  onClick={() =>
                                    updateRule(i, {
                                      excludedCategories: on
                                        ? r.excludedCategories?.filter(
                                            (c) => c !== key,
                                          )
                                        : [
                                            ...(r.excludedCategories ?? []),
                                            key,
                                          ],
                                    })
                                  }
                                >
                                  {label}
                                </button>
                              );
                            },
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tap categories that do not earn this reward.
                        </p>
                      </div>
                    </details>
                    <button
                      type="button"
                      className="min-h-11 text-xs text-danger"
                      onClick={() =>
                        features({
                          rewardRules: draft.features.rewardRules.filter(
                            (_, n) => n !== i,
                          ),
                        })
                      }
                    >
                      Remove this rate
                    </button>
                  </div>
                )}
              </section>
            ))}
            {draft.features.rewardRules.length > 0 &&
              draft.features.rewardRules.length < 16 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addRule()}
                >
                  Add a special category rate
                </Button>
              )}
          </>
        )}
        {step === 2 && (
          <>
            <section className="space-y-3">
              <h3 className="font-semibold">Lounge access</h3>
              {draft.features.lounges.map((r, i) => (
                <div key={r.id} className="space-y-3 rounded-xl border p-3">
                  <Field label="Lounge allowance">
                    <Input
                      aria-label={`Lounge name ${i + 1}`}
                      value={r.name}
                      maxLength={100}
                      onChange={(e) =>
                        updateLounge(i, { name: e.target.value })
                      }
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Visits allowed">
                      <NumberEntry
                        label={`Lounge allowance ${i + 1}`}
                        value={r.visits || null}
                        onChange={(v) => updateLounge(i, { visits: v ?? 0 })}
                      />
                    </Field>
                    <Field label="Resets">
                      <Select
                        aria-label={`Lounge reset ${i + 1}`}
                        value={r.period}
                        onChange={(e) =>
                          updateLounge(i, {
                            period: e.target.value as LoungeRule["period"],
                          })
                        }
                      >
                        {["month", "quarter", "calendar_year", "card_year"].map(
                          (k) => (
                            <option key={k} value={k}>
                              {PERIOD_LABELS[k as LoungeRule["period"]]}
                            </option>
                          ),
                        )}
                      </Select>
                    </Field>
                  </div>
                  {r.annualLimit && (
                    <Field
                      label={`Annual limit: ${r.annualLimit.visits} visits`}
                    >
                      <Select
                        aria-label={`Lounge annual reset ${i + 1}`}
                        value={r.annualLimit.period}
                        onChange={(e) =>
                          updateLounge(i, {
                            annualLimit: {
                              ...r.annualLimit!,
                              period: e.target.value as
                                "calendar_year" | "card_year" | "unknown",
                            },
                          })
                        }
                      >
                        <option value="unknown">
                          Year reset not confirmed
                        </option>
                        <option value="calendar_year">Calendar year</option>
                        <option value="card_year">Card year</option>
                      </Select>
                    </Field>
                  )}
                  {r.conditional && (
                    <p className="text-xs text-muted-foreground">
                      Conditional benefit. Choose lounge access after meeting
                      the spend requirement.
                    </p>
                  )}
                  <Field
                    label="Access conditions"
                    hint="Spend threshold, eligible lounges, guest charges, activation…"
                  >
                    <Input
                      aria-label={`Lounge conditions ${i + 1}`}
                      maxLength={1200}
                      value={r.conditions}
                      onChange={(e) =>
                        updateLounge(i, { conditions: e.target.value })
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="min-h-11 text-xs text-danger"
                    onClick={() =>
                      features({
                        lounges: draft.features.lounges.filter(
                          (_, n) => n !== i,
                        ),
                      })
                    }
                  >
                    Remove allowance
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={draft.features.lounges.length >= 8}
                onClick={() =>
                  features({
                    lounges: [
                      ...draft.features.lounges,
                      {
                        id: crypto.randomUUID(),
                        name: "Domestic cardholder visits",
                        visits: 1,
                        period: "quarter",
                        conditions: "",
                        evidence: "Entered and confirmed by you",
                      },
                    ],
                  })
                }
              >
                Add lounge allowance
              </Button>
            </section>
            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">Fee waiver & milestones</h3>
              {draft.milestones.map((m, i) => (
                <div key={m.key} className="space-y-3 rounded-xl border p-3">
                  <Field label="Milestone name">
                    <Input
                      aria-label={`Milestone name ${i + 1}`}
                      value={m.name}
                      maxLength={80}
                      onChange={(e) => milestone(i, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Spend needed ₹">
                    <MoneyInput
                      aria-label={`Milestone target ${i + 1}`}
                      value={m.target || null}
                      onChange={(v) => milestone(i, { target: v ?? 0 })}
                    />
                  </Field>
                  <Field label="Counting period">
                    <Select
                      aria-label={`Milestone period ${i + 1}`}
                      value={m.period}
                      onChange={(e) =>
                        milestone(i, { period: e.target.value as Period })
                      }
                    >
                      {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {m.period === "once" && (
                    <Field label="Deadline">
                      <Input
                        aria-label={`Milestone deadline ${i + 1}`}
                        type="date"
                        value={m.deadline ?? ""}
                        onChange={(e) =>
                          milestone(i, { deadline: e.target.value || null })
                        }
                      />
                    </Field>
                  )}
                  <Field label="What you get">
                    <Input
                      aria-label={`Milestone reward ${i + 1}`}
                      value={m.reward ?? ""}
                      maxLength={160}
                      onChange={(e) =>
                        milestone(i, { reward: e.target.value || null })
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="min-h-11 text-xs text-danger"
                    onClick={() =>
                      patch({
                        milestones: draft.milestones.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Remove milestone
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={draft.milestones.length >= 16}
                onClick={() =>
                  patch({
                    milestones: [
                      ...draft.milestones,
                      {
                        key: crypto.randomUUID(),
                        id: null,
                        name: draft.milestones.some((m) =>
                          m.name.toLowerCase().includes("waiver"),
                        )
                          ? "Spending milestone"
                          : "Annual fee waiver",
                        target: 0,
                        period: "card_year",
                        deadline: null,
                        reward: draft.milestones.some((m) =>
                          m.name.toLowerCase().includes("waiver"),
                        )
                          ? null
                          : "Annual fee waived",
                      },
                    ],
                  })
                }
              >
                Add a waiver or milestone
              </Button>
            </section>
            <details className="border-t pt-3">
              <summary className="cursor-pointer py-2 text-sm text-primary">
                Other benefits & source notes
              </summary>
              <textarea
                aria-label="Other card benefits"
                className="mt-2 min-h-24 w-full rounded-lg border bg-card p-3 text-sm"
                maxLength={16000}
                value={draft.features.details}
                onChange={(e) => features({ details: e.target.value })}
              />
              <Input
                className="mt-2"
                aria-label="Benefit source"
                value={draft.features.source}
                maxLength={200}
                onChange={(e) => features({ source: e.target.value })}
              />
              <Field label="Valid until, if stated">
                <Input
                  aria-label="Benefits valid until"
                  type="date"
                  value={draft.features.validThrough ?? ""}
                  onChange={(e) =>
                    features({ validThrough: e.target.value || null })
                  }
                />
              </Field>
            </details>
          </>
        )}
        {step === 3 && (
          <div className="space-y-4 rounded-xl bg-muted p-4">
            <h3 className="text-lg font-semibold">{draft.label}</h3>
            <p className="text-sm">
              Annual fee:{" "}
              {draft.annualFee === null
                ? "Not set"
                : formatINR(draft.annualFee)}
            </p>
            {!draft.features.rewardRules.length && (
              <p className="text-sm text-muted-foreground">
                Rewards not set yet.
              </p>
            )}
            {draft.features.rewardRules.map((r) => (
              <div key={r.id} className="text-sm">
                <p className="font-medium">
                  {r.category === "general"
                    ? "General spending"
                    : SPEND_CATEGORIES[r.category]}{" "}
                  · {rewardLabel(r)}
                </p>
                {r.points && (
                  <p className="text-muted-foreground">{rewardValueLabel(r)}</p>
                )}
                {r.conditions && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.conditions}
                  </p>
                )}
                {!!r.excludedCategories?.length && (
                  <p className="text-xs text-muted-foreground">
                    Excludes{" "}
                    {r.excludedCategories
                      .map((c) => SPEND_CATEGORIES[c])
                      .join(", ")}
                  </p>
                )}
                {r.cap !== null && (
                  <p className="text-muted-foreground">
                    Cap {formatINR(r.cap)} ·{" "}
                    {r.capPeriod
                      ? PERIOD_LABELS[r.capPeriod]
                      : "reset period unknown"}
                  </p>
                )}
                {r.points?.cap !== null && r.points?.cap !== undefined && (
                  <p className="text-muted-foreground">
                    Cap {r.points.cap} points ·{" "}
                    {r.capPeriod
                      ? PERIOD_LABELS[r.capPeriod]
                      : "reset period unknown"}
                  </p>
                )}
              </div>
            ))}
            {draft.features.lounges.map((r) => (
              <p key={r.id} className="text-sm">
                {r.name}: {r.visits} · {PERIOD_LABELS[r.period]}
              </p>
            ))}
            {draft.milestones.map((m) => (
              <p key={m.key} className="text-sm">
                {m.name}: spend {formatINR(m.target)}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Comparisons depend on your terms, merchant eligibility and
              available caps. Unknown point values are left out.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 flex gap-3 border-t bg-card py-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" className="flex-1" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save card"}
            </Button>
          )}
        </div>
        {card && step === 3 && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            className="w-full"
            disabled={pending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              start(async () => {
                const res = await deleteCard(card.id);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                router.refresh();
                onSaved();
                onClose();
              });
            }}
          >
            {confirmDelete ? "Confirm delete card" : "Delete card"}
          </Button>
        )}
      </fieldset>
    </div>
  );
}
export function CardSetupSheet(
  props: React.ComponentProps<typeof CardSetupForm>,
) {
  return (
    <Sheet
      title={props.card ? "Update your card" : "Set up a card"}
      onClose={props.onClose}
    >
      <CardSetupForm {...props} />
    </Sheet>
  );
}
