# First live stock-source audit

17 Nov 2026. Public issuer facts only. No investment recommendation.

## Observed collection

A read-only database check confirmed the owner's selected ETERNAL snapshot on engine 0.9 at 2026-11-17T18:28:20Z. It has a matching profile ISIN, nine annual periods, ten balance periods, seven cash-flow periods and no report errors. Annual and cash flow end in March 2026, while the balance also has September 2026. Seven exact year ends overlap. All financial-quality flags remain false. This proves collection for this instrument, not all source coverage or correctness.

## Primary references checked

- [Issuer Q3 FY26 shareholder letter](https://b.zmtcdn.com/investor-relations/Eternal_Shareholders_Letter_Q3FY26_Results.pdf), page 3 notes and page 4 discussion: revenue includes the full goods value after the inventory shift, and the issuer distinguishes like-for-like growth.
- [Issuer Q2 FY26 shareholder letter](https://b.zmtcdn.com/investor-relations/Eternal_Shareholders_Letter_Q2FY26_Results.pdf), page 3 notes and page 4 discussion: the same comparability issue.
- [NSE consolidated integrated filing, 21 Oct 2026](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_202852_21102026184843_iXBRL_WEB.html): matching ISIN, consolidated INR reporting in lakhs, and a note on the inventory transition. Its cash-flow period is April to September 2026, not the annual period in the saved cash-flow table. The reported board approval date is not automatically a publication timestamp.
- [FY26 annual report on an exchange host](https://www.msei.in/SX-Content/Listing/Annual-Reports/2026/ETERNAL-2026.pdf) and [issuer FY26 results](https://b.zmtcdn.com/investor-relations/Eternal_Limited_Shareholders_Letter_Q4FY26_Results.pdf) were found in indexed primary-source results. Full downloads were unavailable here; do not claim a complete annual-filing reconciliation from their indexed excerpts.

The primary documents establish an accounting-comparability issue. They do not automatically verify every historical provider value, recurring diluted EPS, period availability, capital-spending definition, peer valuation or price adjustment. No source flag is set true merely from these references.

## Implementation consequences

1. The canonical paper contract requires separate accounting-comparability and recurring-earnings review. Reported revenue growth after a changed accounting/business basis is not automatically organic or comparable growth.
2. Report coverage intersects exact period ends. It does not pair September balance-sheet figures with March annual cash flows.
3. The current tables lack explicit cash balance, capital spending and EBITDA rows. Investments/other assets are not cash, investing cash flow and FCF are not capex, and Operating Profit does not verify an EBITDA definition.
4. Verified observation comparison must preserve identity, metric, duration and consolidated/standalone basis. INR lakh/crore units require explicit conversion. EPS has its own per-share unit. A rounding tolerance must follow the stated rounding increment, not a guessed percentage.
5. Reported EPS is not automatically recurring diluted split-adjusted EPS. The model cannot score valuation with it without that review.

## Remaining work

Implement and verify canonical filing ingestion with actual source metadata and publication/restatement times, acquire comparable point-in-time valuations and verified price adjustments, then evaluate the paper model on real historical and live samples. Hold/exit assessment additionally needs confirmed ownership/allocation/thesis and costs. No live Buy/Hold/Sell output is enabled by this audit or by structural coverage.
