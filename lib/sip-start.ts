/** Months skipped before SIPs begin. Existing finance math counts full monthly
 * periods, so the first normal contribution is in the following calendar month. */
export function sipContributionDelay(today: string, startMonth?: string): number {
  if (!startMonth) return 0;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) throw Error("Choose a valid SIP start month.");
  const index = (s: string) => Number(s.slice(0,4))*12 + Number(s.slice(5,7));
  return Math.max(0, index(startMonth) - index(today) - 1);
}
/** A saved plan is a snapshot. This only prompts a review, never changes amounts. */
export function sipReviewDue(today: string, savedOn: string, startMonth?: string) {
  return today.slice(0,7) > savedOn.slice(0,7) && today.slice(0,7) >= (startMonth ?? savedOn.slice(0,7));
}
