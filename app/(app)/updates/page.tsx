import Link from "next/link";
import { loadLoans } from "@/lib/data";
import { LoanBalanceUpdate } from "@/components/loan-balance-update";

export const metadata = { title: "Update loan balance" };
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ loan?: string;from?:string }>;
}) {
  const { loan: id,from } = await searchParams;
  const returnTo=from==="networth"?"/assets":"/goals";
  const loans = await loadLoans();
  const loan = loans.find((l) => l.id === id);
  return (
    <main className="space-y-4">
      <Link href={returnTo} className="text-sm text-primary">
        Back to {returnTo==="/assets"?"Net worth":"Goals"}
      </Link>
      <h1 className="text-2xl font-semibold">Update loan balance</h1>
      {loan ? (
        <LoanBalanceUpdate loan={loan} returnTo={returnTo} />
      ) : (
        <p>Open a loan update from Net worth or an update reminder.</p>
      )}
    </main>
  );
}
