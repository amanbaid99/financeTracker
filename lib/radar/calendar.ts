/** NSE capital-market calendar verified for the remainder of 2026. Do not extrapolate to BSE or later years.
 * https://nsearchives.nseindia.com/content/circulars/CMTR71775.pdf
 * Special Muhurat session on 8 Nov is included; daily analysis always excludes the current day.
 */
export const CALENDAR_VERSION = "NSE-CMTR71775-2026-remainder";
const holidays = new Set(["2026-11-10", "2026-11-24", "2026-12-25"]);
export function previousNseSession(
  today: string,
  exchange: string,
): string | null {
  if (exchange !== "NSE" || today < "2026-11-09" || today > "2026-12-31")
    return null;
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 10; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    if (iso === "2026-11-08") return iso;
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays.has(iso))
      return iso;
  }
  return null;
}
