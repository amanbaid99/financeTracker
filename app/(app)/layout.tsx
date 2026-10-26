import { Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTabs } from "@/components/app-tabs";
import { DisclaimerFooter } from "@/components/disclaimer";
import { GuidesProvider } from "@/components/guides";
import { Logo } from "@/components/logo";
import { loadOnboarding, needsPrivacyConsent } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await needsPrivacyConsent()) redirect("/consent");
  const { seenGuides, releases } = await loadOnboarding();
  return (
    <GuidesProvider seenGuides={seenGuides} releases={releases}>
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
          <Link href="/goals" aria-label="Tracker home">
            <Logo />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
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
