"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { acceptPrivacy, signOut } from "@/lib/actions";

export function ConsentForm() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I have read and agree to the{" "}
          <a href="/privacy" target="_blank" className="font-medium underline">
            privacy policy
          </a>
          .
        </span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button
          disabled={!agree || pending}
          onClick={() =>
            start(async () => {
              const r = await acceptPrivacy();
              if (!r.ok) setError(r.error);
              else router.replace("/home");
            })
          }
        >
          Continue
        </Button>
        <form action={signOut}>
          <Button variant="ghost" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
