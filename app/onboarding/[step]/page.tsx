import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INTRO, StepBody } from "@/components/step-body";
import { Progress } from "@/components/ui/progress";
import { loadRaw } from "@/lib/data";
import { flowIndex, nextHref, ONBOARDING_FLOW, prevHref, STEPS, stepIndex, type StepSlug } from "@/lib/onboarding";

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
  const position = flowIndex(slug);
  // Sections outside the short first-time flow always behave like edit pages.
  const editing = sp.edit === "1" || Boolean(raw.profile.onboarding_completed_at) || position === -1;
  const next = nextHref(slug, editing);
  const back = prevHref(slug, editing);

  return (
    <main className="space-y-6">
      {!editing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Step {position + 1} of {ONBOARDING_FLOW.length}
            {position === ONBOARDING_FLOW.length - 1 ? "" : " · takes under a minute"}
          </p>
          <Progress value={((position + 1) / ONBOARDING_FLOW.length) * 100} label="Onboarding progress" />
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
