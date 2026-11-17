# First stock paper assessment

17 Nov 2026. Engineering experiment, no live recommendations or orders.

## Implemented scope

The first model in lib/radar/stock-model.ts considers explicitly verified profitable non-financial businesses. It is not appropriate for financial institutions, loss-making/turnaround businesses or unreviewed sectors. Sector eligibility must be established by a source adapter and business review, not inferred from a company name. Peer comparability is also a required reviewed input, not a list of superficially similar names.

The canonical contract requires three or more consecutive completed annual reports with publication/restatement availability times and source URLs, one consolidated INR/rupee basis and recurring diluted EPS on the same split-adjusted share basis as prices. Historical and peer P/E use last-published annual recurring diluted earnings, never an undocumented mix of TTM, forecast and annual multiples. Three distinct peer ISINs must have the same valuation session, with no self comparison. Historical observations must span three calendar years, be ordered and have actual availability times. This sparse historical requirement is a starting experiment, not a complete valuation distribution.

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

Current IndianAPI collections have unverified amount units, currency, ISIN, statement basis and publication times. They remain raw report coverage, not StockSources. No canonical adapter is connected yet. The latest read-only ETERNAL snapshot still predates the internal-ID fix and contains no reports. Its owner must explicitly refresh to validate source mapping. Production credentials were not retrieved, and no background or hosted user-record update was made.

Next: verify actual source identity and report samples, audit metadata against filings, implement the canonical adapter, replay with point-in-time and delisted coverage plus costs, evaluate an untouched historical period, and monitor live paper results. Holding/exit models need confirmed portfolio and allocation/thesis context before independent validation. Never copy provider analyst ratings into the result.

## References

These sources support analytical concepts, not this model's thresholds or performance:

- [Agreed product requirements](PRD.md), section 6.4, for factor weights and sector isolation.
- [CFA Institute: Introduction to Financial Statement Analysis](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/introduction-financial-statement-analysis), for profitability, growth and cash generation as financial-analysis subjects.
- [CFA Institute: Market-Based Valuation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/market-based-valuation-price-enterprise-value-multiples), for appropriately comparable peer and historical multiples.
- [CFA Institute: Evaluating Quality of Financial Reports](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/evaluating-quality-financial-reports), for accounting quality, cash-flow comparison and business context.
