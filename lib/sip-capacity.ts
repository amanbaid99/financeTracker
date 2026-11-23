/** Manual capacity is an explicit planning assumption only when no budget is saved. */
export function sipCapacity(
  configured: boolean,
  budgetAvailable: number,
  budgetDeficit: number,
  declared?: unknown,
) {
  if (configured)
    return {
      availableSavings: budgetAvailable,
      budgetDeficit,
      source: "budget" as const,
    };
  const amount =
    typeof declared === "number" &&
    Number.isSafeInteger(declared) &&
    declared >= 0 &&
    declared <= 1e9
      ? declared
      : 0;
  return {
    availableSavings: amount,
    budgetDeficit: 0,
    source: "manual" as const,
  };
}
