import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/data";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function ConsentPage() {
  await requireUser();
  return (
    <main className="space-y-5">
      <Logo />
      <h1 className="text-xl font-semibold">Please review our privacy policy</h1>
      <p className="text-sm text-muted-foreground">
        To keep using Tracker, please read and accept the current privacy policy. It explains what we store, that
        your data is private to you, and how optional AI explanations work.
      </p>
      <ConsentForm />
    </main>
  );
}
