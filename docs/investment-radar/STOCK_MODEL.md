# First stock paper assessment

17 Nov 2026. Engineering experiment, no live recommendations or orders.

## Implemented scope

The first model in lib/radar/stock-model.ts considers explicitly verified profitable non-financial businesses. It is not appropriate for financial institutions, loss-making/turnaround businesses or unreviewed sectors. Sector eligibility must be established by a source adapter and business review, not inferred from a company name. Peer comparability is also a required reviewed input, not a list of superficially similar names.

Version stock-paper-3 additionally requires explicit accounting-comparability and recurring-earnings review. Reported growth after a business/accounting change cannot score until comparable data is established. These reviews cannot be implied by successful currency normalization.

The canonical contract requires three or more consecutive completed annual reports with publication/restatement availability times and source URLs, one consolidated INR/rupee basis and recurring diluted EPS on the same split-adjusted share basis as prices. Historical and peer P/E use last-published annual recurring diluted earnings, never an undocumented mix of TTM, forecast and annual multiples. Three distinct peer ISINs must have the same valuation session, with no self comparison. Historical observations must span three calendar years, be ordered and have actual availability times. Each historical and peer observation now includes its closing price, annual diluted recurring EPS, earnings period, source and publication time, plus an explicit adjustment check. The model calculates P/E itself. Earnings published after the observation session, stale annual earnings, impossible dates and nonfinite derived ratios stop scoring. An opaque provider P/E alone is insufficient. This sparse historical requirement is a starting experiment, not a complete valuation distribution.

At least 252 ordered, valid adjusted price observations must end on a completed assessment session. Annual reports older than 550 days fail. Inputs published after assessment, invalid dates, missing years, duplicate peers, mismatched identity and nonfinite calculations stop all paper scoring. Fiscal period end and retrieval time are never substituted for publication time. A timestamp contract can test supplied evidence but cannot prove an upstream provider supplied truthful point-in-time data; real adapters and filing audits remain necessary.

## Calculations and experimental parameters

The original PRD weights are quality 30%, valuation 30%, earnings/growth 20% and technical conditions 20%. Scores within each factor are the fraction of its explicit tests that pass, scaled to 100.

- Quality: positive operating and post-capital-spending cash in each of the latest three years; three-year operating cash/net profit at least 1; gross debt/latest EBITDA at most 2; latest net profit margin at least 5%.
- Valuation: current price/latest published annual recurring diluted EPS compared separately with the median supplied own historical P/E and same-session comparable-peer P/E.
- Growth: revenue and recurring diluted EPS CAGR across the latest three annual observations, using actual period distance, each at least 5%.
- Technical: close at least its 200-session average, and Wilder RSI(14) between 35 and 65.

A paper candidate requires at least 75/100 and no cash-generation, leverage or relative-valuation risk gate. Otherwise complete data produces paper Wait. Missing data produces neither a paper score nor a paper decision. Negative or zero earnings/EBITDA requires a different model; a negative P/E is never treated as cheap. All numerical thresholds are transparent engineering proposals, not validated optimal settings, expected returns or published professional recommendations. No parameter tuning or performance claim is made.

This is a screening experiment rather than intrinsic-value estimation. Cash-flow classifications, exceptional items, accounting differences, industry cyclicality, fiscal-year differences, peer selection and adjustment conventions require audit before any investment use. It does not cover business thesis, governance, interest coverage, management quality, order execution, dividends, taxes, transaction costs or ownership/allocation. There is no Hold/Review selling output in this first entry experiment. Paper Wait is not a sell instruction.

## Integration and release gate

Automatic research invokes the paper calculator but always retains the live Research not ready result and null score. The live UI displays missing inputs under Data checks and limitations, not a paper score or recommendation. Release is fixed as paper in code; a caller-supplied flag cannot promote it. ETFs never route through this stock model.

Current IndianAPI collections have unverified amount units, currency, ISIN, statement basis and publication times. They remain raw report coverage, not StockSources. No canonical adapter is connected yet. The latest read-only ETERNAL snapshot now contains all three reports with a cross-source ISIN match. Actual collection is verified, but the tables do not supply all canonical fields or metadata. Primary issuer reporting documents an inventory-accounting change, so raw reported revenue growth cannot be treated as comparable growth. See STOCK_SOURCE_AUDIT.md. Production credentials were not retrieved, and no background or hosted user-record update was made.

Next: verify actual source identity and report samples, audit metadata against filings, implement the canonical adapter, replay with point-in-time and delisted coverage plus costs, evaluate an untouched historical period, and monitor live paper results. Holding/exit models need confirmed portfolio and allocation/thesis context before independent validation. Never copy provider analyst ratings into the result.

## References

These sources support analytical concepts, not this model's thresholds or performance:

- [Agreed product requirements](PRD.md), section 6.4, for factor weights and sector isolation.
- [CFA Institute: Introduction to Financial Statement Analysis](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/introduction-financial-statement-analysis), for profitability, growth and cash generation as financial-analysis subjects.
- [CFA Institute: Market-Based Valuation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/market-based-valuation-price-enterprise-value-multiples), for appropriately comparable peer and historical multiples.
- [CFA Institute: Evaluating Quality of Financial Reports](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/evaluating-quality-financial-reports), for accounting quality, cash-flow comparison and business context.

## Offline forward-outcome audit, 18 Nov 2026

lib/radar/stock-replay.ts evaluates dated source snapshots using only prices up to each assessment session. Assessments must be unique, ordered and recorded on the stated session in IST. The caller declares the holdout boundary, horizon in sessions and estimated costs per side. Eligible observations use the next available session close as a hypothetical entry, then the specified later close as an exit. Costs apply on both sides. Missing source evidence produces neither a decision nor an outcome. Missing future sessions leave an outcome pending.

This is an initial outcome-audit harness, not the complete PRD portfolio backtester. Returns exclude dividends, taxes and cash flows; next-close fills are assumptions, overlapping windows cannot be compounded, and selected instruments do not establish delisted coverage. The holdout label cannot prove data was untouched during development. No performance metric, optimisation result or live release is claimed. Tests use synthetic data only. Real point-in-time source datasets and independent evaluation remain necessary.

## Paper holding and exit review, 18 Nov 2026

lib/radar/stock-position.ts now evaluates the existing entry model plus an explicit, same-ISIN holding context. It requires positive confirmed ownership, recorded allocation, a confirmed target and percentage-point allowance, reviewed thesis, estimated exit costs and explicit context confirmation. Context must be available by assessment time and reviewed within 90 days. That freshness limit is an experimental engineering setting, not a validated optimal review schedule. No age-derived individual-stock target, thesis or fee is invented.

Complete entry evidence plus intact thesis and allocation within the allowance produces paper Hold candidate. A broken confirmed thesis or allocation above the confirmed target plus allowance produces paper Review selling, with rebalancing explicitly distinct from a full exit. Uncertain thesis or a failed entry screen produces Review holding. A failed entry screen alone is never a sell case. Missing source evidence or invalid/missing context produces no holding/exit decision, even when the supplied thesis is broken. Estimated costs are retained, not treated as a complete after-tax execution calculation.

Automatic research invokes the paper position model for confirmed owners. It still returns live Research not ready and a null score even when paper inputs pass. The optional Review holding details form now collects explicitly confirmed target/band, thesis status and estimated exit costs for an existing confirmed stock holding. The server supplies ISIN and review time; current recorded allocation comes from matched Tracker holdings. No allocation or cost is defaulted. Saved or removed reviews do not release live recommendations; recorded holding value alone cannot fill reviewed context. There is no production Hold/Sell release, user-data write, schema change or claim of historical exit-model validation. Real verified inputs, suitable sector support, prospective context collection and independent entry/exit validation remain necessary.
