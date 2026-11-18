import type { RadarAnalysis } from "./contracts";
import { previousCompletedSession } from "./calendar";
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Uses today's verified exchange calendar, never the date saved with an old snapshot. */
export function priceFreshness(analysis: RadarAnalysis | null, today: string, exchange: string) {
  const close = analysis?.close != null && Number.isFinite(analysis.close) && analysis.close > 0 ? analysis.close : null;
  const asOf = validDate(analysis?.asOf) ? analysis.asOf : null;
  const expected = validDate(today) ? previousCompletedSession(today, exchange) : null;
  const current = close !== null && asOf !== null && expected !== null && asOf === expected;
  const reason = close === null ? "Refresh to get prices." : expected === null
    ? "The exchange calendar needs updating before current prices can be confirmed."
    : "Refresh to get the latest completed-session prices.";
  return { current, close, asOf, expected, reason: current ? null : reason };
}
