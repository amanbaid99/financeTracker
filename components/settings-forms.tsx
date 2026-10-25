"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { applyTheme, ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount, saveTheme, signOut } from "@/lib/actions";
import type { Accent, Theme } from "@/lib/theme";

function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = "Saved") =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    });
  const status = msg && (
    <span role="status" className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>
      {msg.text}
    </span>
  );
  return { pending, run, status };
}

export function ThemeSettings({ theme: t0, accent: a0 }: { theme: Theme; accent: Accent }) {
  const [theme, setTheme] = useState(t0);
  const [accent, setAccent] = useState(a0);
  const { pending, run, status } = useAction();
  return (
    <div className="space-y-4">
      <ThemePicker
        theme={theme}
        accent={accent}
        onChange={(t, a) => {
          setTheme(t);
          setAccent(a);
          applyTheme(t, a);
        }}
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => run(() => saveTheme({ theme, accent }))} disabled={pending}>
          Save look
        </Button>
        {status}
      </div>
    </div>
  );
}

export function AccountSettings() {
  const [confirm, setConfirm] = useState("");
  const { pending, run, status } = useAction();
  return (
    <div className="space-y-5">
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
      <div className="space-y-2 rounded-lg border border-danger/40 p-3">
        <p className="text-sm font-medium text-danger">Delete account</p>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your account, goals and investments. This can&apos;t be undone.
        </p>
        <Field label="Type DELETE to confirm" htmlFor="del">
          <Input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || confirm !== "DELETE"}
            onClick={() => run(() => deleteAccount(confirm))}
          >
            Delete everything
          </Button>
          {status}
        </div>
      </div>
    </div>
  );
}
