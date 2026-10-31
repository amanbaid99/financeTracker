// When a value drops a lot, the app asks whether money was taken out. If it
// was, the amount invested goes down by the same share, so the gain shown
// stays right instead of counting the withdrawal as a loss.

/** A drop worth asking about: at least 10% and ₹1,000. */
export function isBigDrop(oldValue: number, newValue: number): boolean {
  return (
    oldValue > 0 && newValue < oldValue * 0.9 && oldValue - newValue >= 1000
  );
}

/** Amount invested after taking money out, in proportion to what's left. */
export function investedAfterWithdrawal(
  oldInvested: number,
  oldValue: number,
  newValue: number,
): number {
  if (oldValue <= 0) return oldInvested;
  return Math.round((oldInvested * Math.max(0, newValue)) / oldValue);
}
