import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTRO, StepBody } from "@/components/step-body";
import { Progress } from "@/components/ui/progress";
import { loadRaw } from "@/lib/data";
import { nextHref, prevHref, STEPS, stepIndex, type StepSlug } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Set up" };

export default async function StepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ edit?: string; add?: string }>;
}) {
  const { step } = await params;
  const sp = await searchParams;
  const index = stepIndex(step);
  if (index === -1) notFound();
  const slug = step as StepSlug;
  const meta = STEPS[index];
  const raw = await loadRaw();
  const editing = sp.edit === "1" || Boolean(raw.profile.onboarding_completed_at);
  const next = nextHref(slug, editing);
  const back = prevHref(slug, editing);

  return (
    <main className="space-y-6">
      {!editing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Step {index + 1} of {STEPS.length}
            {meta.optional ? " · optional" : ""}
          </p>
          <Progress value={((index + 1) / STEPS.length) * 100} label="Onboarding progress" />
        </div>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{INTRO[slug]}</p>
      </div>
      <StepBody slug={slug} editing={editing} next={next} back={back} add={sp.add} />
    </main>
  );
}
