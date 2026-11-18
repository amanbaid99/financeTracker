# INDstocks historical price policy

18 Nov 2026. Based on the owner's supplied written INDmoney support confirmation. The correspondence, personal greeting, ticket identifier and token are not committed. This records provider policy, not an independently audited event sample or verified historical dataset.

## Confirmed scope

OHLC fields o/h/l/c are adjusted for splits and bonus issues. Consolidations are handled when recorded as splits. Historical prices before the ex-date use shares-before / shares-after and are rounded to two decimals; the ex-date and subsequent candles are unchanged. Volume v is actual unadjusted share volume. The policy applies across supported intervals.

Dividends, rights issues, mergers and demergers are not adjusted. Dividend exclusion is compatible with price-only charts and split-consistent price/earnings comparisons, but the price series is not a total-return series. Dividend cash flows are required for total-return evaluation. Other unsupported actions need investment-specific review before historical continuity can be considered verified.

There is no dedicated public corporate-actions endpoint and no per-candle adjustment flag. The source says to refetch historical prices after a new split or bonus issue; old downloaded data does not update itself. Current daily requests already refetch the full selected window in successive windows of at most 365 days. Do not apply another split/bonus factor to these returned prices.

Reference for the request/response shape: [INDstocks Historical Data](https://api-docs.indstocks.com/historicalData/). The support confirmation supplies the adjustment semantics missing from that page. No new live event sample is claimed from the example response.

## Application behaviour

history-policy.ts records the confirmed scope and collection timestamp only on a new explicit refresh. Snapshot input hashes include this metadata. Existing snapshots retain their original metadata and are not silently relabelled or rewritten. The history UI and source checks distinguish confirmed policy from full event coverage, EPS-basis consistency, liquidity and model validation.

Split-adjusted historical price multiplied by raw volume does not establish original daily rupee turnover. Technicals now require an explicit compatible turnover basis before computing averageTradedValue20; the application collection path withholds it. Old saved estimates cannot mark research liquidity ready without that basis. The Gold paper model has the same explicit liquidity prerequisite. A reliable actual-turnover series or compatible raw price/volume series would be a separate input.

The partial policy does not set full action/EPS verification, total-return readiness, traded-value verification or a live recommendation. No provider key, account API, database migration, background job or hosted-record mutation is introduced. The owner can refresh a selected instrument after deployment to save the new evidence.
