import { redirect } from "next/navigation";

/** Old goal links open the goal on the list instead. */
export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/goals?open=${encodeURIComponent(id)}`);
}
