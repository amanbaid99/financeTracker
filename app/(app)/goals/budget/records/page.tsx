import { redirect } from "next/navigation";

/** Income and costs now live in the budget itself (one source of truth). */
export default function BudgetRecordsPage() {
  redirect("/goals/budget");
}
