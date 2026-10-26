"use client";

import { MessageCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { askQuestion, setAskEnabled, type AskTurn } from "@/lib/ask/actions";
import { cn } from "@/lib/utils";

const STARTERS = [
  "I need ₹50,000 for a skin treatment next month. Where should it come from?",
  "Am I on track for my goals?",
  "Should I prepay my loan or invest more?",
  "Where should my next ₹10,000 go?",
];

interface Message {
  role: "user" | "assistant";
  /** What goes back to the AI next turn (codes, not names). */
  coded: string;
  /** What you see. */
  shown: string;
}

/** **bold** inside a line. */
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/** Paragraphs and simple lists from the AI's plain text. */
function Answer({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ list: false, lines: [] });
      continue;
    }
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const last = blocks.at(-1);
    if (item) {
      if (last?.list) last.lines.push(item[1]);
      else blocks.push({ list: true, lines: [item[1]] });
    } else if (last && !last.list && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ list: false, lines: [line] });
    }
  }
  return (
    <div className="space-y-2">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.list ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{inline(b.lines.join(" "))}</p>
          ),
        )}
    </div>
  );
}

export function AskChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: Message[] = [...messages, { role: "user", coded: q, shown: q }];
    setMessages(next);
    setDraft("");
    setError("");
    start(async () => {
      const history: AskTurn[] = next.map((m) => ({
        role: m.role,
        content: m.coded,
      }));
      const res = await askQuestion(history);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", coded: res.coded, shown: res.shown },
      ]);
    });
  }

  return (
    <div className="space-y-4 pb-36">
      {messages.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ask anything about your goals and investments. If it needs more to
            go on, it&apos;ll ask you.
          </p>
          <div className="flex flex-col gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-xl border bg-card p-3 text-left text-sm hover:border-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="space-y-3" aria-label="Conversation">
        {messages.map((m, i) => (
          <li
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card",
              )}
            >
              {m.role === "assistant" ? <Answer text={m.shown} /> : m.shown}
            </div>
          </li>
        ))}
        {pending && (
          <li className="flex justify-start" aria-live="polite">
            <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              Thinking…
            </div>
          </li>
        )}
      </ol>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <div ref={end} />

      <form
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            aria-label="Your question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Ask about your money…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            className="size-10"
            aria-label="Send"
            disabled={pending || !draft.trim()}
          >
            <Send aria-hidden />
          </Button>
        </div>
        <p className="mx-auto mt-1 max-w-3xl text-[11px] text-muted-foreground">
          Not investment advice. Don&apos;t type personal details like your PAN.
        </p>
      </form>
    </div>
  );
}

/** Shown until Ask is turned on: exactly what is sent, and a clear choice. */
export function AskConsent() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <MessageCircle className="size-8 text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">Ask questions about your money</p>
        <p className="text-sm text-muted-foreground">
          Like &quot;where should ₹50,000 for a treatment come from?&quot;
          Answers use your goals and investments, and it asks you if it needs
          more.
        </p>
      </div>
      <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
        <p className="font-medium">
          What&apos;s sent to the AI (through OpenRouter)
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Your goals and investments as codes like &quot;Goal 1, wedding, ₹20L
            by 2030&quot;, with amounts rounded.
          </li>
          <li>
            Kinds of funds (e.g. &quot;liquid fund&quot;), never their names,
            your nicknames or your goal names.
          </li>
          <li>Your questions, as you type them.</li>
          <li>
            Card feature documents or descriptions you choose to read in Cards,
            with card numbers, emails and phone numbers masked.
          </li>
        </ul>
        <p className="font-medium">Never sent</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Your name, email, PAN, folio or account numbers.</li>
        </ul>
        <p className="text-muted-foreground">
          Chats aren&apos;t saved. Some free AI models may keep what they
          receive. You can turn Ask off any time in Settings.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setAskEnabled(true);
            if (!res.ok) return setError(res.error ?? "Couldn't turn it on.");
            router.refresh();
          })
        }
      >
        {pending ? "Turning on…" : "Turn on Ask"}
      </Button>
    </div>
  );
}
