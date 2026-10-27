import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";
import { AppTabs } from "@/components/app-tabs";
import { DisclaimerFooter } from "@/components/disclaimer";
import { GuidesProvider } from "@/components/guides";
import { Logo } from "@/components/logo";
import { SettingsLink } from "@/components/nav-pending";
import { QuickAdd } from "@/components/quick-add";
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
      <header className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-2 px-4">
          <Link href="/home" aria-label="Tracker home">
            <Logo />
          </Link>
          <SettingsLink />
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3">
        {/* Fades only on tab changes (links tagged "tab"); saves and
            refreshes update in place. */}
        <ViewTransition
          default="none"
          update={{ tab: "tab-fade", default: "none" }}
        >
          {children}
        </ViewTransition>
        <DisclaimerFooter />
      </div>
      <QuickAdd />
      <AppTabs />
    </GuidesProvider>
  );
}
