import { fetchAmfiNav, type EtfEvidence, type MarketDepth } from "./etf-data";
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
  const depth = async () => {
    try { evidence.depth = await readDepth(); }
    catch { evidence.errors.push("Market spread could not be verified. Refresh to retry."); }
  };
  await Promise.all([readNav(), depth()]);
  return evidence;
}
