"use client";

import { Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addInvite, removeInvite } from "@/lib/actions";

export interface Invite {
  email: string;
  note: string | null;
  joined: boolean;
}

function inviteText(email: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `I've invited you to Tracker, a private app for tracking money goals. Open ${origin}/login and sign in with ${email}. You'll get a code by email.`;
}

/** Share sheet on phones; copy to clipboard elsewhere. */
async function share(email: string): Promise<string> {
  const text = inviteText(email);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Tracker invite", text });
      return "";
    }
    await navigator.clipboard.writeText(text);
    return "Invite message copied. Paste it into WhatsApp or email.";
  } catch {
    return "";
  }
}

export function InviteSettings({
  invites,
  me,
}: {
  invites: Invite[];
  me: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Add their email here.</li>
        <li>Send them the invite message (share button).</li>
        <li>
          They open the link, enter that email and sign in with the code they
          get. Only invited emails can join.
        </li>
      </ol>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          start(async () => {
            const res = await addInvite({ email, note });
            if (!res.ok) return setMsg({ ok: false, text: res.error });
            setJustAdded(email.trim().toLowerCase());
            setEmail("");
            setNote("");
            setMsg({ ok: true, text: "Invited. Now send them the message." });
            router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Their email" htmlFor="inv-email">
            <Input
              id="inv-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Note (optional)" htmlFor="inv-note">
            <Input
              id="inv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
              placeholder="e.g. Riya"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Invite"}
          </Button>
          {justAdded && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const t = await share(justAdded);
                if (t) setMsg({ ok: true, text: t });
              }}
            >
              <Share2 /> Send invite message
            </Button>
          )}
        </div>
        {msg && (
          <p
            role="status"
            className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}
          >
            {msg.text}
          </p>
        )}
      </form>

      <ul className="divide-y rounded-lg border" aria-label="Invited people">
        {invites.map((i) => (
          <li key={i.email} className="flex items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate">{i.email}</p>
              {i.note && (
                <p className="truncate text-xs text-muted-foreground">
                  {i.note}
                </p>
              )}
            </div>
            <Badge variant={i.joined ? "success" : "muted"}>
              {i.joined ? "Joined" : "Invited"}
            </Badge>
            {!i.joined && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Send invite to ${i.email}`}
                onClick={async () => {
                  const t = await share(i.email);
                  if (t) setMsg({ ok: true, text: t });
                }}
              >
                <Share2 className="size-4" aria-hidden />
              </Button>
            )}
            {i.email !== me && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove invite for ${i.email}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeInvite(i.email);
                    setMsg(
                      res.ok
                        ? { ok: true, text: `Removed ${i.email}.` }
                        : { ok: false, text: res.error },
                    );
                    router.refresh();
                  })
                }
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Removing an invite stops new sign-ups with that email. Someone who
        already joined keeps their account.
      </p>
    </div>
  );
}
