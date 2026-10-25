import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ImportFlow } from "@/components/import-flow";

export const metadata: Metadata = { title: "Import statement" };

export default function ImportPage() {
  return (
    <main className="space-y-4">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Your goals
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Import a statement
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload your CAS and we&apos;ll update every fund&apos;s value in one
          go. You check everything before it&apos;s saved.
        </p>
      </div>
      <ImportFlow />
    </main>
  );
}
