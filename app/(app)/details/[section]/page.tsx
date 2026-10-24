import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { INTRO, StepBody } from "@/components/step-body";
import { STEPS, type StepSlug } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Edit details" };

const EDITABLE: StepSlug[] = ["basics", "household", "income", "expenses", "insurance", "liabilities", "risk"];

export default async function EditSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "holdings") redirect("/holdings");
  if (section === "goals") redirect("/goals");
  if (!EDITABLE.includes(section as StepSlug)) notFound();
  const slug = section as StepSlug;
  const meta = STEPS.find((s) => s.slug === slug)!;
  return (
    <main className="mx-auto max-w-xl space-y-5">
      <Link href="/details" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> My details
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{INTRO[slug]}</p>
      </div>
      <StepBody slug={slug} editing next="/details" back="/details" />
    </main>
  );
}
