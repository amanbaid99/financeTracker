"use client";

import { CardSetupForm } from "@/components/card-setup";
import {
  CardReadingProgress,
  type CardReadingStage,
} from "@/components/card-reading-progress";
import { CARD_RESEARCH_PROMPT } from "@/lib/card-research";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Review } from "@/lib/card-extract";
import { setAskEnabled } from "@/lib/ask/actions";
import { extractCardFeatures } from "@/lib/card-extract-actions";
import type { Card } from "@/lib/cards";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

async function pdfText(file: File, password: string): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  if (file.size > 4_300_000) throw new Error("This file is over 4 MB.");
  const res = await fetch("/api/pdf_text", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Blob([`${password}\n`, file]),
  });
  let body: { ok?: boolean; text?: string; message?: string; code?: string };
  try {
    body = await res.json();
  } catch {
    throw new Error(
      "The PDF reader isn't available right now. Try again in a minute.",
    );
  }
  if (!res.ok || !body.ok || !body.text) {
    const e = new Error(body.message ?? "Couldn't read this PDF.");
    (e as Error & { code?: string }).code = body.code;
    throw e;
  }
  return body.text;
}

/** Reads a card's features from a PDF or a description, then lets you pick what to keep. */
export function CardFeaturesSheet({
  card,
  onClose,
}: {
  card: Card | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [copyStatus, setCopyStatus] = useState("");
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CARD_RESEARCH_PROMPT);
      setCopyStatus(
        "Prompt copied. Replace the card placeholder in your AI tool.",
      );
    } catch {
      setCopyStatus(
        "Copy unavailable. Open the prompt below and select the text.",
      );
    }
  };
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [needsAi, setNeedsAi] = useState(false);
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<CardReadingStage>("features");

  const read = async (allowAi = false) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (allowAi) {
        setStage("permission");
        const on = await setAskEnabled(true);
        if (!on.ok) return setError(on.error ?? "Couldn't turn on AI.");
        setNeedsAi(false);
      }
      let source = text;
      if (mode === "pdf") {
        if (!file) return setError("Pick the card's features PDF first.");
        try {
          setStage("pdf");
          source = await pdfText(file, password);
        } catch (e) {
          if ((e as { code?: string }).code === "password")
            setAskPassword(true);
          return setError(
            e instanceof Error ? e.message : "Couldn't read this PDF.",
          );
        }
      }
      setStage("features");
      const res = await extractCardFeatures({ text: source });
      if (!res.ok) {
        if (res.needsAi) return setNeedsAi(true);
        return setError(res.error);
      }
      if (
        !res.review.annualFee &&
        !res.review.rewards &&
        !res.review.benefits.length &&
        !res.review.milestones.length &&
        !res.review.featureDraft
      )
        return setError(
          "No card features found in this. Try the card's key facts or benefits document.",
        );
      if (res.review.featureDraft?.source === "Card brochure") {
        res.review.featureDraft.source =
          mode === "pdf"
            ? file?.name.slice(0, 200) || "Card brochure"
            : "Typed or pasted features";
      }
      setReview(res.review);
    } catch {
      setError(
        "Couldn't finish reading. Your text or file is still here. Try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet
      title={
        review
          ? "Review your card"
          : card
            ? `Read ${card.label} features`
            : "Add a card from its features"
      }
      onClose={onClose}
    >
      {review ? (
        <CardSetupForm
          card={card}
          initialReview={review}
          onSaved={() => {}}
          onClose={onClose}
        />
      ) : (
        <>
          {pending && (
            <CardReadingProgress stage={stage} isPdf={mode === "pdf"} />
          )}
          <div className="space-y-4" hidden={pending}>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="How to add features"
            >
              {(
                [
                  ["pdf", "Upload PDF"],
                  ["text", "Paste features"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={mode === v}
                  onClick={() => setMode(v)}
                  className={cn(
                    "min-h-11 rounded-md px-2 py-1.5 text-sm",
                    mode === v
                      ? "bg-card font-medium shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            {mode === "pdf" ? (
              <div className="space-y-3" role="tabpanel">
                <Field
                  label="Card features PDF"
                  htmlFor="f-pdf"
                  hint="The bank's key facts, benefits guide or MITC. Not a statement."
                >
                  <Input
                    id="f-pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                {askPassword && (
                  <Field label="PDF password" htmlFor="f-pass">
                    <Input
                      id="f-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                )}
              </div>
            ) : (
              <div className="space-y-3" role="tabpanel">
                <p className="text-sm text-muted-foreground">
                  No document? Type the features you know or paste information
                  from your preferred AI tool. Check it against official sources
                  before saving.
                </p>
                <Field
                  label="Card features or researched answer"
                  htmlFor="f-text"
                  hint="Public card terms only. Leave out personal details and card numbers."
                >
                  <textarea
                    id="f-text"
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={40000}
                    placeholder="Paste rewards, caps, exclusions and lounge benefits, with official links if available."
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={copyPrompt}
                >
                  Copy AI research prompt
                </Button>
                {copyStatus && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {copyStatus}
                  </p>
                )}
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-3 text-primary">
                    View prompt
                  </summary>
                  <textarea
                    aria-label="AI research prompt"
                    readOnly
                    value={CARD_RESEARCH_PROMPT}
                    rows={9}
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-lg border bg-card p-3 text-sm"
                  />
                </details>
              </div>
            )}

            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              AI makes a draft from your text. Check the rates, conditions and
              other benefits before saving. Card numbers, emails and phone
              numbers are masked first. The PDF isn&apos;t kept. Reviewed terms
              are saved only after you confirm.
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            {needsAi ? (
              <div className="space-y-3 rounded-lg border border-primary p-3 text-sm">
                <p className="font-medium">Allow AI to read this?</p>
                <p className="text-muted-foreground">
                  The text is sent to AI models through OpenRouter, with card
                  numbers, emails and phone numbers masked. This turns on the
                  same AI switch as Ask, which you can turn off in Settings.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setNeedsAi(false)}
                  >
                    Not now
                  </Button>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => read(true)}
                  >
                    {pending ? "Reading…" : "Allow and read"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={() => read()}
              >
                {pending ? "Reading…" : "Read features"}
              </Button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
