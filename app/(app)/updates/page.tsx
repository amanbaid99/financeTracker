import Link from "next/link";
import { loadLoans } from "@/lib/data";
import { LoanBalanceUpdate } from "@/components/loan-balance-update";

export const metadata = { title: "Update loan balance" };
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ loan?: string }>;
}) {
  const { loan: id } = await searchParams;
  const loans = await loadLoans();
  const loan = loans.find((l) => l.id === id);
  return (
    <main className="space-y-4">
      <Link href="/goals" className="text-sm text-primary">
        Back to Goals
      </Link>
      <h1 className="text-2xl font-semibold">Update loan balance</h1>
      {loan ? (
        <LoanBalanceUpdate loan={loan} />
      ) : (
        <p>Open a loan update from Goals.</p>
      )}
    </main>
  );
}
