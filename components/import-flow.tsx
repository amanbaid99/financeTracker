"use client";

import { AlertTriangle, CheckCircle2, FileUp, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import type { ParsedStatement, ReviewRow } from "@/lib/statement/review";
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
  /** Set once the user changes anything on the row: their answer. */
  touched: boolean;
}

const CATEGORY_Q = "What kind of fund is this?";

/** Questions still open for a row, given the user's answers so far. */
function openQs(r: ReviewRow, s: RowState): string[] {
  if (s.target === "skip") return [];
  const qs = r.questions.filter((q) =>
    q === CATEGORY_Q ? !s.category : !s.touched,
  );
  if (r.kind === "mutual_fund" && !s.category && !qs.includes(CATEGORY_Q))
    qs.push(CATEGORY_Q);
  return qs;
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

export function ImportFlow() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [state, setState] = useState<Record<string, RowState>>({});
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
                touched: false,
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

  const openQuestions = useMemo(() => {
    if (!ready) return 0;
    return ready.rows.filter((r) => {
      const s = state[r.key];
      return s ? openQs(r, s).length > 0 : false;
    }).length;
  }, [ready, state]);

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
        <Button type="button" onClick={() => router.push("/goals")}>
          Back to your goals
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
        <Field
          label="Statement PDF"
          htmlFor="cas-file"
          hint="CAS from CAMS, KFintech, NSDL or CDSL. Up to 4 MB."
        >
          <Input
            id="cas-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </Field>
        <Field
          label="PDF password"
          htmlFor="cas-pw"
          hint="CAMS / KFintech: the password you chose when you asked for it. NSDL / CDSL: usually your PAN in capitals."
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
          fund&apos;s category.
        </p>
      </form>
    );
  }

  const set = (key: string, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch, touched: true } }));
  const withIssues = ready.rows.filter((r) => r.issues.length).length;

  return (
    <div className="space-y-4 pb-24">
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

      {openQuestions > 0 && (
        <p
          className="flex items-center gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning"
          role="status"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {openQuestions} holding{openQuestions === 1 ? " needs" : "s need"} a
          quick check before saving.
        </p>
      )}

      <ul className="space-y-3">
        {ready.rows.map((r) => {
          const s = state[r.key];
          const skipped = s.target === "skip";
          const matched = s.target !== "new" && !skipped;
          const oldValue = matched
            ? (ready.investments.find((i) => i.id === s.target)?.value ?? null)
            : null;
          const questions = openQs(r, s);
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
                  {oldValue !== null && oldValue !== r.value && (
                    <p className="tabular text-xs text-muted-foreground">
                      was {formatINR(oldValue)}
                    </p>
                  )}
                </div>
              </div>

              {questions.map((q) => (
                <p
                  key={q}
                  className="rounded-lg bg-warning-soft p-2 text-xs text-warning"
                >
                  {q}
                </p>
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
                    onChange={(e) => set(r.key, { target: e.target.value })}
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
                      onChange={(v) => set(r.key, { sip: v ?? 0 })}
                    />
                  </Field>
                )}
                {s.target === "new" && ready.goals.length > 0 && (
                  <Field label="Counts toward" htmlFor={`g-${r.key}`}>
                    <Select
                      id={`g-${r.key}`}
                      aria-label={`${r.name}: goal`}
                      value={s.goalId}
                      onChange={(e) => set(r.key, { goalId: e.target.value })}
                    >
                      <option value="">No goal yet</option>
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={save}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save these values"}
          </Button>
        </div>
      </div>
    </div>
  );
}
