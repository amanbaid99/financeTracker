import { RadarProviderError } from "./indmoney";
import { DepthUnavailableError, fetchAmfiNav, type EtfEvidence, type MarketDepth, type MarketEvidence } from "./etf-data";
import { fetchNavHistory } from "./nav-history";

/** Parallel source reads, preserving independent successes. No source failure becomes fabricated evidence. */
export async function collectEtfEvidence({ isin, expectedSession, now, readDepth, request = fetch }: {
  isin: string | null;
  expectedSession: string | null;
  now: string;
  readDepth: () => Promise<MarketDepth>;
  request?: typeof fetch;
}): Promise<EtfEvidence> {
  const evidence: EtfEvidence = { nav: null, depth: null, errors: [] };
  const readNav = async () => {
    if (!isin) return;
    try {
      evidence.nav = await fetchAmfiNav(isin, request);
    } catch {
      evidence.errors.push("Official NAV could not be fetched. Refresh to retry.");
      return;
    }
    if (!evidence.nav || !expectedSession || evidence.nav.date !== expectedSession) return;
    try {
      evidence.navHistory = await fetchNavHistory(evidence.nav, expectedSession, now, request);
    } catch {
      evidence.errors.push("Historical NAV could not be checked against AMFI. Prices and latest NAV are still saved; refresh later to retry history.");
    }
  };
  const readMarket = collectMarketEvidence(readDepth).then((market) => {
    evidence.depth = market.depth;
    evidence.depthStatus = market.depthStatus;
    evidence.errors.push(...market.errors);
  });
  await Promise.all([readNav(), readMarket]);
  return evidence;
}

/** The shared quote read also serves individual stocks; NAV is never required for a stock. */
export async function collectMarketEvidence(readDepth: () => Promise<MarketDepth>): Promise<MarketEvidence> {
  const evidence: MarketEvidence = { depth: null, errors: [] };
  try {
    evidence.depth = await readDepth();
    evidence.depthStatus = {
      state: evidence.depth.timestampVerified ? "available-timestamped" : "available-untimestamped",
      message: evidence.depth.timestampVerified
        ? "The source supplied a timestamped book. Its age is checked separately."
        : "Bid and ask were returned, but the REST source does not document a market timestamp. Spread freshness is unverified.",
    };
  } catch (error) {
    const reason = error instanceof DepthUnavailableError || error instanceof RadarProviderError
      ? error.reason : "source-unavailable";
    const messages = {
      "no-active-book": "No active bid and ask were returned. This can happen outside trading hours or when no two-sided market is available. Repeated refreshes may not help.",
      "invalid-book": "Market depth was incomplete or inconsistent. No spread has been assumed.",
      "access-denied": "Market-depth access was denied or the INDmoney token expired. Check Radar connection and the token in Vercel.",
      "rate-limited": "INDmoney limited the market-depth request. Wait before refreshing again.",
      "source-unavailable": "Market depth could not be read. The source did not provide a usable book; this does not prove there were no buyers or sellers.",
    };
    evidence.depthStatus = { state: "unavailable", reason, message: messages[reason] };
    evidence.errors.push(messages[reason]);
  }
  return evidence;
}
