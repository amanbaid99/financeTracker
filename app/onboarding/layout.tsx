import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { needsPrivacyConsent } from "@/lib/data";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  if (await needsPrivacyConsent()) redirect("/consent");
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <Logo />
      </header>
      {children}
    </div>
  );
}
