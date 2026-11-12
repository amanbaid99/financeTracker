import { BackLink } from "@/components/back-link";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import { ImportFlow } from "@/components/import-flow";

export const metadata: Metadata = { title: "Import statement" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Back to where you came from: Portfolio, or Goals by default.
  const back =
    (await searchParams).from === "portfolio"
      ? { href: "/portfolio", label: "Portfolio" }
      : { href: "/goals", label: "Your goals" };
  return (
    <main className="space-y-4">
      <BackLink fallback={back.href} label={back.label} />
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Import a statement
          </h1>
          <GuideButton id="import" />
        </div>
        <p className="text-sm text-muted-foreground">
          Upload your CAS and we&apos;ll update every fund&apos;s value in one
          go. You check everything before it&apos;s saved.
        </p>
      </div>
      <ImportFlow back={back} />
    </main>
  );
}
