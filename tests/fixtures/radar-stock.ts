import type { StockSources } from "@/lib/radar/stock-model";
export const isin = "INE000000001", session = "2026-11-16", now = "2026-11-17T04:30:00Z";
export const sources = (): StockSources => ({
  isin, sector: "technology", modelEligibilityVerified: true,
  currency: "INR", units: "rupees", basis: "consolidated", epsBasis: "diluted-recurring-split-adjusted", metadataVerified: true,
  annualComparabilityVerified: true, recurringEarningsVerified: true,
  annual: [2024, 2025, 2026].map((year, i) => ({ end: `${year}-03-31`, availableAt: `${year}-05-15T10:00:00Z`, source: "https://filings.example/annual",
    revenue: 1000 * 1.1 ** i, netProfit: 100 * 1.1 ** i, operatingCash: 140 * 1.1 ** i, capitalSpending: 10,
    debt: 50, cash: 20, ebitda: 150, eps: 10 * 1.1 ** i })),
  historicalPe: [2023, 2024, 2025].map((year) => ({ date: `${year}-11-15`, availableAt: `${year}-11-15T12:00:00Z`, close: 200, adjustmentsVerified: true,
    earnings: { end: `${year}-03-31`, availableAt: `${year}-05-15T10:00:00Z`, eps: 10, source: "https://filings.example/historical" },
    source: "https://valuations.example/history", earningsBasis: "last-published-annual-diluted-recurring" })),
  peers: [2, 3, 4].map((i) => ({ isin: `INE00000000${i}`, date: session, availableAt: `${session}T12:00:00Z`, close: 200, adjustmentsVerified: true,
    earnings: { end: "2026-03-31", availableAt: "2026-05-15T10:00:00Z", eps: 10, source: "https://filings.example/peer" },
    source: "https://valuations.example/peers", earningsBasis: "last-published-annual-diluted-recurring" })),
  peerComparabilityVerified: true,
});
export const candles = Array.from({ length: 260 }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 16 - 259 + i)).toISOString().slice(0, 10), open: 100, high: 100, low: 100, close: 100, volume: 100000 }));

