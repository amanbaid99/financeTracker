import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTabs } from "@/components/app-tabs";
import { DisclaimerFooter } from "@/components/disclaimer";
import { GuidesProvider } from "@/components/guides";
import { Logo } from "@/components/logo";
import { SettingsLink } from "@/components/nav-pending";
import { loadOnboarding, needsPrivacyConsent } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [needsConsent, { seenGuides, releases }] = await Promise.all([
    needsPrivacyConsent(),
    loadOnboarding(),
  ]);
  if (needsConsent) redirect("/consent");
  return (
    <GuidesProvider seenGuides={seenGuides} releases={releases}>
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
          <Link href="/goals" aria-label="Tracker home">
            <Logo />
          </Link>
          <SettingsLink />
        </div>
        <AppTabs />
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-5">
        {children}
        <DisclaimerFooter />
      </div>
    </GuidesProvider>
  );
}
