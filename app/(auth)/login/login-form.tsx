"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { PRIVACY_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  if (/database error|not on the invite list|saving new user/i.test(message)) {
    return "This email isn't on the invite list. Ask the person who invited you to add it.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many sign-in emails were sent. Wait a minute and try again.";
  }
  return message;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError ? friendlyError(initialError) : "");

  const redirectTo = () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base}/auth/callback?consent=${PRIVACY_VERSION}`;
  };

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return setError("Please accept the privacy policy to continue.");
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (error) setError(friendlyError(error.message));
    else setSent(true);
  }

  async function google() {
    if (!agreed) return setError("Please accept the privacy policy to continue.");
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setBusy(false);
      setError(friendlyError(error.message));
    }
  }

  if (sent) {
    return (
      <div className="space-y-2 text-center" role="status">
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Open it on this
          device and browser.
        </p>
        <Button variant="link" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-describedby="consent-text"
          name="consent"
        />
        <span id="consent-text">
          I agree to the{" "}
          <a href="/privacy" target="_blank" className="font-medium underline underline-offset-2">
            privacy policy
          </a>{" "}
          and understand Tracker is a planning tool, not investment advice.
        </span>
      </label>

      <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 4.01 14.55 3 12 3 6.98 3 3 7.03 3 12s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.29-1.1z"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={sendLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
