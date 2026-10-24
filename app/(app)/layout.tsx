import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DisclaimerFooter } from "@/components/disclaimer";
import { loadRaw, needsPrivacyConsent } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (await needsPrivacyConsent()) redirect("/consent");
  const raw = await loadRaw();
  if (!raw.profile.onboarding_completed_at) redirect("/onboarding/basics");
  return (
    <>
      <AppNav />
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 md:pb-10">
        {children}
        <DisclaimerFooter />
      </div>
    </>
  );
}
