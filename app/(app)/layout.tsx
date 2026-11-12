import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { AppTabs } from "@/components/app-tabs";
import { NavHistory } from "@/components/back-link";
import { ToastProvider } from "@/components/ui/toast";
import { TourProvider } from "@/components/tour";
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
    <TourProvider>
      <GuidesProvider seenGuides={seenGuides} releases={releases}>
        <ToastProvider>
          <header className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-2 px-4">
              <Link href="/goals" aria-label="Tracker home">
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
          <AppTabs />
          <Suspense fallback={null}>
            <NavHistory />
          </Suspense>
        </ToastProvider>
      </GuidesProvider>
    </TourProvider>
  );
}

// Background portfolio reviews may try a free model and a paid fallback.
export const maxDuration = 180;
