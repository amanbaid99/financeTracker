import { ChevronLeft } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
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
      <Link
        href={back.href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> {back.label}
      </Link>
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
