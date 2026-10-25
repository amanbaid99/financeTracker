import type { Metadata } from "next";
import { GoalsBoard } from "@/components/goals-board";
import { loadGoals } from "@/lib/data";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const { goals, investments, links } = await loadGoals();
  return <GoalsBoard goals={goals} investments={investments} links={links} />;
}
