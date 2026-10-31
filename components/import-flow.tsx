"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CasGuideButton } from "@/components/cas-guide";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { categoryLabel } from "@/lib/categories";
import { formatDate, formatINR } from "@/lib/format";
import { FUND_CATEGORIES } from "@/lib/instruments";
import {
  applyImport,
  prepareImport,
  type ImportChoice,
  type PrepareResult,
} from "@/lib/statement/actions";
import type {
  ParsedStatement,
  Question,
  ReviewRow,
} from "@/lib/statement/review";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  CAMS: "CAMS",
  KFINTECH: "KFintech",
  NSDL: "NSDL",
  CDSL: "CDSL",
};
const HOW: Record<ReviewRow["categoryHow"], string> = {
  yours: "as you set it",
  "from its name": "from its name",
  "two models agreed": "two AI models agreed",
  "checked by a third model": "AI, checked by a third model",
  ask: "",
};

type Ready = Extract<PrepareResult, { ok: true }>;

interface RowState {
  /** "new", "skip", or an existing investment id. */
  target: string;
  category: string | null;
  sip: number | null;
  goalId: string;
  /** The user answered "is this your …?" (by tapping yes/no or picking an investment). */
  matchAnswered: boolean;
  /** The user answered "has your SIP stopped?". */
  sipAnswered: boolean;
}

/** Questions still waiting for an answer. */
function openQuestions(r: ReviewRow, s: RowState): Question[] {
  if (s.target === "skip") return [];
  const open = r.questions.filter((q) => {
    if (q.kind === "confirm_match" || q.kind === "which_match")
      return !s.matchAnswered;
    if (q.kind === "sip_stopped")
      return !s.sipAnswered && s.target === r.match?.id;
    return !s.category;
  });
  if (
    r.kind === "mutual_fund" &&
    !s.category &&
    !open.some((q) => q.kind === "category")
  ) {
    open.push({ kind: "category", text: "What kind of fund is this?" });
  }
  return open;
}

interface Change {
  key: string;
  action: "update" | "add" | "skip";
  title: string;
  lines: string[];
  unchanged: boolean;
}

/** Plain list of what saving will do, for the confirm step. */
function describeChanges(
  ready: Ready,
  state: Record<string, RowState>,
): Change[] {
  return ready.rows.map((r) => {
    const s = state[r.key];
    if (s.target === "skip")
      return {
        key: r.key,
        action: "skip",
        title: r.name,
        lines: [],
        unchanged: true,
      };
    const goal = ready.goals.find((g) => g.id === s.goalId)?.name;
    if (s.target === "new") {
      const lines = [`Value ${formatINR(r.value)}`];
      if (s.sip) lines.push(`SIP ${formatINR(s.sip)} a month`);
      if (s.category) lines.push(categoryLabel(s.category));
      lines.push(goal ? `Counts toward ${goal}` : "Not linked to a goal");
      return {
        key: r.key,
        action: "add",
        title: r.name,
        lines,
        unchanged: false,
      };
    }
    const inv = ready.investments.find((i) => i.id === s.target)!;
    const lines: string[] = [];
    if (inv.value !== r.value)
      lines.push(`Value ${formatINR(inv.value)} → ${formatINR(r.value)}`);
    if (s.sip !== null && s.sip !== inv.sip)
      lines.push(`SIP ${formatINR(inv.sip)} → ${formatINR(s.sip)} a month`);
    if (r.kind === "mutual_fund" && s.category && s.category !== inv.category) {
      lines.push(
        `Kind ${categoryLabel(inv.category)} → ${categoryLabel(s.category)}`,
      );
    }
    if (goal) lines.push(`Also counts toward ${goal}`);
    return {
      key: r.key,
      action: "update",
      title: inv.name,
      lines,
      unchanged: lines.length === 0,
    };
  });
}

/** Sends the PDF straight to the statement reader with the user's sign-in token. */
async function readStatement(
  file: File,
  password: string,
): Promise<ParsedStatement> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  if (file.size > 4_300_000)
    throw new Error(
      "This file is over 4 MB. Download the statement for a shorter period.",
    );
  const res = await fetch("/api/cas_parse", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Blob([`${password}\n`, file]),
  });
  let body: { ok?: boolean; message?: string } & Partial<ParsedStatement>;
  try {
    body = await res.json();
  } catch {
    throw new Error(
      "The statement reader isn't available right now. Try again in a minute.",
    );
  }
  if (!res.ok || !body.ok)
    throw new Error(body.message ?? "The statement couldn't be read.");
  return body as ParsedStatement;
}

export function ImportFlow({
  back = { href: "/goals", label: "Your goals" },
}: {
  back?: { href: string; label: string };
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [stage, setStage] = useState("");

  function read() {
    if (!file) return setError("Choose the statement PDF first.");
    setError("");
    start(async () => {
      try {
        setStage("Reading the statement…");
        const statement = await readStatement(file, password);
        setStage("Matching to your investments…");
        const res = await prepareImport(statement);
        if (!res.ok) throw new Error(res.error);
        setReady(res);
        setState(
          Object.fromEntries(
            res.rows.map((r) => [
              r.key,
              {
                target: r.match?.id ?? "new",
                category: r.category,
                sip: r.sip,
                goalId: "",
                matchAnswered: false,
                sipAnswered: false,
              },
            ]),
          ),
        );
        setPassword("");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "The statement couldn't be read.",
        );
      } finally {
        setStage("");
      }
    });
  }

  const openCount = useMemo(
    () =>
      ready
        ? ready.rows.filter(
            (r) => state[r.key] && openQuestions(r, state[r.key]).length,
          ).length
        : 0,
    [ready, state],
  );

  function save() {
    if (!ready) return;
    const choices: ImportChoice[] = ready.rows.map((r) => {
      const s = state[r.key];
      const action =
        s.target === "skip" ? "skip" : s.target === "new" ? "add" : "update";
      return {
        action,
        investmentId: action === "update" ? s.target : null,
        name: r.name,
        isin: r.isin,
        kind: r.kind,
        category: s.category,
        value: r.value,
        invested: r.invested,
        sip: s.sip,
        goalId: s.goalId || null,
      };
    });
    setError("");
    start(async () => {
      const res = await applyImport(choices);
      if (!res.ok) return setError(res.error);
      setDone(
        `Updated ${res.updated} and added ${res.added} investment${res.added === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <p className="font-semibold">{done}</p>
        <p className="text-sm text-muted-foreground">
          Your goals now use the values from this statement.
        </p>
        <Button type="button" onClick={() => router.push(back.href)}>
          Back to {back.label.toLowerCase()}
        </Button>
      </div>
    );
  }

  if (!ready) {
    return (
      <form
        className="space-y-4 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          read();
        }}
      >
        <CasGuideButton />
        <Field
          label="Statement PDF"
          htmlFor="cas-file"
          hint="CAS from CAMS, KFintech, NSDL or CDSL. Up to 4 MB."
        >
          {/* A big tap or drop area; the real file input is hidden inside. */}
          <label
            htmlFor="cas-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition-colors focus-within:border-primary hover:border-primary",
              dragging && "border-primary bg-primary-soft",
              file && "border-solid border-primary/50 bg-primary-soft/50",
            )}
          >
            <FileUp className="size-6 text-primary" aria-hidden />
            <span className="break-all text-sm font-medium">
              {file ? file.name : "Choose your CAS PDF"}
            </span>
            <span className="text-xs text-muted-foreground">
              {file
                ? `${(file.size / 1e6).toFixed(1)} MB · tap to change`
                : "Tap to pick a file, or drop it here"}
            </span>
            <input
              id="cas-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </Field>
        <Field
          label="PDF password"
          htmlFor="cas-pw"
          hint="CAMS / KFintech: the password you chose when you asked for it. NSDL / CDSL: usually based on your PAN; the email says which."
        >
          <Input
            id="cas-pw"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          <FileUp /> {pending ? stage || "Working…" : "Read statement"}
        </Button>
        <p className="text-xs text-muted-foreground">
          The file is read and thrown away; it isn&apos;t stored, and neither is
          the password. Personal details like your PAN and folio numbers never
          leave the reader. Only fund names may be sent to AI to work out a
          fund&apos;s category. Nothing changes until you confirm.
        </p>
      </form>
    );
  }

  const set = (key: string, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  if (confirming) {
    const changes = describeChanges(ready, state);
    const updates = changes.filter(
      (c) => c.action === "update" && !c.unchanged,
    );
    const adds = changes.filter((c) => c.action === "add");
    const same = changes.filter((c) => c.action === "update" && c.unchanged);
    const skips = changes.filter((c) => c.action === "skip");
    const group = (title: string, list: Change[], tone = "") =>
      list.length > 0 && (
        <section className="space-y-2" aria-label={title}>
          <h2 className="text-sm font-semibold">{title}</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {list.map((c) => (
              <li key={c.key} className="space-y-0.5 p-3 text-sm">
                <p className={cn("font-medium", tone)}>{c.title}</p>
                {c.lines.map((l) => (
                  <p key={l} className="tabular text-xs text-muted-foreground">
                    {l}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      );
    return (
      <div className="space-y-4 pb-32">
        <div className="space-y-1 rounded-2xl border bg-card p-4">
          <p className="font-semibold">Check before saving</p>
          <p className="text-sm text-muted-foreground">
            {updates.length} update{updates.length === 1 ? "" : "s"},{" "}
            {adds.length} new investment
            {adds.length === 1 ? "" : "s"}
            {skips.length ? `, ${skips.length} skipped` : ""}. Nothing changes
            until you confirm.
          </p>
        </div>
        {group("Will update", updates)}
        {group("Will add", adds)}
        {group("Already up to date", same, "text-muted-foreground")}
        {group("Will skip", skips, "text-muted-foreground")}
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-3xl space-y-2">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Go back
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={pending || updates.length + adds.length === 0}
              >
                {pending ? "Saving…" : "Confirm and save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const withIssues = ready.rows.filter((r) => r.issues.length).length;

  return (
    <div className="space-y-4 pb-28">
      <div className="space-y-1 rounded-2xl border bg-card p-4">
        <p className="font-semibold">
          {SOURCE_LABEL[ready.source] ?? ready.source} statement
          {ready.statementDate ? ` · ${formatDate(ready.statementDate)}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {ready.rows.length} holding{ready.rows.length === 1 ? "" : "s"} read.{" "}
          {withIssues ? (
            <span className="text-warning">
              {withIssues} didn&apos;t add up, so check them below.
            </span>
          ) : (
            "Every value checks out against units × NAV."
          )}
        </p>
        {!ready.detailed && (
          <p className="text-xs text-muted-foreground">
            This is a summary statement, so SIPs stay as you have them. A
            detailed one also picks up your SIPs.
          </p>
        )}
        {ready.warnings.map((w) => (
          <p key={w} className="text-xs text-muted-foreground">
            {w}
          </p>
        ))}
      </div>

      {openCount > 0 && (
        <p
          className="flex items-center gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning"
          role="status"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {openCount} holding{openCount === 1 ? " needs" : "s need"} your answer
          before you can save.
        </p>
      )}

      <ul className="space-y-3">
        {ready.rows.map((r) => {
          const s = state[r.key];
          const skipped = s.target === "skip";
          const updating = s.target !== "new" && !skipped;
          const target = updating
            ? ready.investments.find((i) => i.id === s.target)
            : undefined;
          const questions = openQuestions(r, s);
          const choices = ready.investments.filter(
            (i) => i.isFund === (r.kind === "mutual_fund"),
          );
          const needsCategory = r.kind === "mutual_fund" && !s.category;
          return (
            <li
              key={r.key}
              className={cn(
                "space-y-3 rounded-2xl border bg-card p-4",
                skipped && "opacity-60",
                questions.length > 0 && "border-warning/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  {r.kind === "mutual_fund" && s.category && (
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(s.category)}
                      {HOW[r.categoryHow] && s.category === r.category
                        ? ` · ${HOW[r.categoryHow]}`
                        : ""}
                      {r.categoryHow.includes("model") &&
                        s.category === r.category && (
                          <Sparkles
                            className="ml-1 inline size-3 text-primary"
                            aria-label="AI"
                          />
                        )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold">
                    {formatINR(r.value)}
                  </p>
                  {target && target.value !== r.value && (
                    <p className="tabular text-xs text-muted-foreground">
                      was {formatINR(target.value)}
                    </p>
                  )}
                </div>
              </div>

              {questions.map((q) => (
                <div
                  key={q.kind}
                  className="space-y-2 rounded-lg bg-warning-soft p-2 text-xs text-warning"
                >
                  <p>{q.text}</p>
                  {q.kind === "confirm_match" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => set(r.key, { matchAnswered: true })}
                      >
                        Yes, that&apos;s it
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          set(r.key, { target: "new", matchAnswered: true })
                        }
                      >
                        No, it&apos;s new
                      </Button>
                    </div>
                  )}
                  {q.kind === "which_match" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Pick it under &quot;This is&quot;, or</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => set(r.key, { matchAnswered: true })}
                      >
                        Keep the one selected
                      </Button>
                    </div>
                  )}
                  {q.kind === "sip_stopped" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          set(r.key, { sip: 0, sipAnswered: true })
                        }
                      >
                        Yes, it stopped
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          set(r.key, { sip: q.previousSip, sipAnswered: true })
                        }
                      >
                        No, keep {formatINR(q.previousSip)} a month
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {r.issues.map((i) => (
                <p key={i} className="text-xs text-warning">
                  {i}
                </p>
              ))}

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="This is" htmlFor={`t-${r.key}`}>
                  <Select
                    id={`t-${r.key}`}
                    aria-label={`${r.name}: this is`}
                    value={s.target}
                    onChange={(e) =>
                      set(r.key, {
                        target: e.target.value,
                        matchAnswered: true,
                      })
                    }
                  >
                    <option value="new">A new investment</option>
                    {choices.map((i) => (
                      <option key={i.id} value={i.id}>
                        Update “{i.name}”
                      </option>
                    ))}
                    <option value="skip">Skip it</option>
                  </Select>
                </Field>
                {r.kind === "mutual_fund" && !skipped && (
                  <Field label="Kind of fund" htmlFor={`c-${r.key}`}>
                    <Select
                      id={`c-${r.key}`}
                      aria-label={`${r.name}: kind of fund`}
                      value={s.category ?? ""}
                      onChange={(e) =>
                        set(r.key, { category: e.target.value || null })
                      }
                      className={cn(needsCategory && "border-warning")}
                    >
                      <option value="">Pick one</option>
                      {FUND_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {r.sipFromStatement && !skipped && (
                  <Field label="Monthly SIP" htmlFor={`s-${r.key}`}>
                    <MoneyInput
                      id={`s-${r.key}`}
                      aria-label={`${r.name}: monthly SIP`}
                      value={s.sip}
                      onChange={(v) =>
                        set(r.key, { sip: v ?? 0, sipAnswered: true })
                      }
                    />
                  </Field>
                )}
                {!skipped && ready.goals.length > 0 && (
                  <Field
                    label={updating ? "Also count toward" : "Counts toward"}
                    htmlFor={`g-${r.key}`}
                  >
                    <Select
                      id={`g-${r.key}`}
                      aria-label={`${r.name}: goal`}
                      value={s.goalId}
                      onChange={(e) => set(r.key, { goalId: e.target.value })}
                    >
                      <option value="">
                        {updating ? "No change" : "No goal yet"}
                      </option>
                      {ready.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setError("");
              setConfirming(true);
              window.scrollTo({ top: 0 });
            }}
            disabled={openCount > 0}
          >
            {openCount > 0 ? (
              `Answer ${openCount} question${openCount === 1 ? "" : "s"} to continue`
            ) : (
              <>
                Review changes <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
