// The kinds of goal a user can pick, with a short prompt and a sensible
// inflation default for each.

export const GOAL_TYPES = [
  { value: "house_down_payment", label: "House", blurb: "Down payment or the whole home", inflation: 6 },
  { value: "vehicle", label: "Car or bike", blurb: "Your next vehicle", inflation: 5 },
  { value: "education", label: "Education", blurb: "Yours or a child's", inflation: 10 },
  { value: "wedding", label: "Wedding", blurb: "Yours or family's", inflation: 6 },
  { value: "travel", label: "Travel", blurb: "A trip you're planning", inflation: 6 },
  { value: "retirement", label: "Retirement", blurb: "Money to stop working on", inflation: 6 },
  { value: "emergency_fund", label: "Emergency fund", blurb: "Months of expenses, kept safe", inflation: 0 },
  { value: "bills_fund", label: "Bills fund", blurb: "Insurance, gym and other planned payments", inflation: 0 },
  { value: "loan_payoff", label: "Pay off a loan", blurb: "Close a home, car or personal loan early", inflation: 0 },
  { value: "custom", label: "Something else", blurb: "Any other goal", inflation: 0 },
] as const;

export type GoalType = (typeof GOAL_TYPES)[number]["value"];

const byValue = new Map<string, (typeof GOAL_TYPES)[number]>(GOAL_TYPES.map((t) => [t.value, t]));

export function goalTypeInfo(v: string) {
  return byValue.get(v) ?? byValue.get("custom")!;
}

export function asGoalType(v: string): GoalType {
  return (byValue.has(v) ? v : "custom") as GoalType;
}
