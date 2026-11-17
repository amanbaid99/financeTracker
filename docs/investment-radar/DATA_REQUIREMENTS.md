# Gold research: source verification and release requirements

Checked 17 Nov 2026. Personal research only. No orders or account API access.

## What was verified

The current INDstocks documentation describes raw OHLCV fields and paged daily history. It does not document a corporate-action adjustment guarantee or an adjustment factor. A returned history series must not be marked adjusted merely because it looks continuous.

The REST full/depth quote examples provide bid/ask depth but no documented market timestamp. Fetch time, HTTP Date, an undocumented quote_time, or a last-trade timestamp cannot establish the age of the book.

The WebSocket documentation supplies a timestamp in the LTP example but does not specify a complete quote/depth payload and its timestamp semantics. This is a possible route to resolve the spread gap, subject to provider confirmation and a real quote sample. It is not yet integrated or verified as a timestamped book source.

Official references:

- [INDstocks historical data](https://api-docs.indstocks.com/historicalData/)
- [INDstocks market quotes](https://api-docs.indstocks.com/MarketQuote/)
- [INDstocks WebSocket feed](https://api-docs.indstocks.com/Websockets/)
- [AMFI NAV download](https://www.amfiindia.com/net-asset-value/nav-download)

Current live app evidence: the owner's refresh screenshot shows an exact-ISIN same-session NAV comparison. This does not verify historical adjustments, tracking data, fresh depth or a forecasting model. No production token was retrieved for local testing. Documentation review is not a live API coverage test.

## Exact data still needed

| Input | Required contract | Current position |
| --- | --- | --- |
| Adjusted ETF history | At least 252 completed OHLCV sessions, adjustment convention, splits/distributions coverage and dates | INDstocks prices connected, adjustment semantics unverified |
| Official historical NAV | Exact ISIN, scheme identity, 252 session dates, values and actual publication/availability times | Latest AMFI NAV connected; MFapi secondary history adapter integrated with latest-point reconciliation. Full-history audit, publication times and adjustments remain unverified |
| Domestic Gold benchmark | Named series and provider, INR basis, consistent units, 252 matching dates, actual availability times and adjustment convention | Official NSE spot-history page identified, but no verified payload adapter or matching valuation-time mapping yet |
| Timestamped depth | Matching exchange/security, active bid/ask and a documented book/publication timestamp | REST depth connected, timestamp contract missing |
| ETF tracking | Aligned NAV and benchmark daily returns on the same valuation basis and sessions | Calculation implemented; verified input series missing |

No additional paid provider has been purchased or selected. The next source decision requires documented coverage and sample payloads for these fields, either from INDstocks/AMFI or another provider. A new API token alone does not demonstrate that coverage. Keep all credentials in Vercel, not chat.

## Implemented paper model

`lib/radar/gold-model.ts` implements a versioned, deterministic Gold-only model. The source contract validates identity, dates, publication times, INR benchmark basis, ordering, matching sessions and latest NAV consistency. It recomputes spread from bid/ask instead of trusting a cached percentage. Missing inputs stop paper decisions too.

The explicit initial guardrails are engineering proposals, not calibrated PRD weights: at most 1% premium, review discounts beyond 5%, spread at most 0.5%, daily traded value at least ₹1 crore, tracking error and absolute annualised tracking difference at most 2%. A paper entry also requires benchmark drawdown of 5% to 20%, RSI 30 to 60, volatility at most 30%, benchmark at least 95% of its 200-session average and no more than 105% of its 50-session average.

These thresholds are stored in GOLD_MODEL. They have not been selected through an optimisation run and have not been shown to outperform regular investing. They are not inferred from the unreadable Gold weights in the PRD. There is no opportunity score or confidence percentage. Model output is paper-only; the app does not promote its candidate to a live Buy recommendation. Hold and exit logic remain separate unfinished work requiring allocation, thesis and costs.

`lib/radar/paper-replay.ts` implements a reusable historical comparison harness. Model, fixed-date monthly, immediate-when-cash-arrives and simple-dip strategies share the same starting cash, monthly inflows and costs. The model and simple-dip strategies buy a quarter of available cash per eligible session; immediate and monthly baselines deploy their available cash at their respective times. The simple dip compares the prior close with the prior 90 closing prices and uses a 5% threshold. These are simulation policies, not purchase suggestions.

A signal must be available after its own close and strictly before the following session's open. Late signals are skipped for that open. Trades use the following open, never the signal's own close. Costs reduce purchasable units. Unitised drawdown removes deposits while preserving overnight price changes before each deposit. Reports include contributed cash, final value, profit, cash, fees, purchases, cash exposure and drawdown. They do not claim XIRR or annual returns.

## What has not been validated

Unit tests with synthetic inputs establish calculation and control behaviour. They do not establish predictive value. No real-data performance report, out-of-sample evaluation, baseline outperformance claim, source ingestion or live paper monitoring is complete.

Before a production recommendation release:

1. Verify source rights, mapping and contracts against real payloads. Connect the missing adapters and preserve their provenance in immutable snapshots.
2. Run the model on historical, point-in-time data. Keep development and holdout windows separate, use unchanged parameters and report every baseline including cash drag and costs.
3. Independently reconcile benchmark returns, NAV premiums, tracking metrics and sample decisions.
4. Monitor live paper decisions through publication delays, holidays and source failures. Do not replace missing inputs with AI or inferred timestamps.
5. Review the evidence before changing the model's paper-only release policy. Unit-test success or a synthetic candidate cannot enable production calls.


## NAV history connection, 17 Nov 2026

The app now attempts [MFapi historical NAV](https://www.mfapi.in/docs/) when an official same-session AMFI NAV is available. The documented endpoint is GET /mf/{scheme_code} with bounded startDate/endDate. Only the public official scheme code and dates are sent, with no broker token, user details or ISIN. Requests use a fixed HTTPS host, reject redirects, time out after 12 seconds and reject responses over 1 MB. Existing snapshot/cooldown behaviour limits repeat calls.

The parser requires exact scheme code and ISIN metadata, positive decimal NAVs and valid dates, rejects duplicate sessions, excludes outside-window dates and reconciles the latest point with AMFI. Latest-point reconciliation is not independent verification of every historical value. Raw upstream errors are not returned to the client. Current prices, official NAV and depth are retained independently if history fails. Snapshots retain the secondary source, retrieval time, official anchor and observed NAV dates/values. Neither publication time nor adjustment verification is fabricated. This separate NavHistory contract does not populate the model's GoldSources contract.

MFapi's documentation confirms the API contract and no-key access. Live API coverage has not been proven here: this workspace's outbound proxy returned HTTP 403 to the direct source request, and the web fetch tool could not retrieve that JSON endpoint. Adapter and pipeline tests use synthetic payloads. Do not report those tests or a Vercel build as proof that an owner's live NAV history was fetched. The user's next explicit Refresh research will exercise the deployed data path.

The [NSE domestic spot-history page](https://www.nseindia.in/historical-spot-price) and [AMFI tracking disclosures](https://www.amfiindia.com/otherdata/tracking-error) are identifiable primary sources, but their downloadable payloads and valuation-time mapping remain unverified. Do not invent an API URL from the page's existence. The [SEBI February 2026 valuation circular](https://www.sebi.gov.in/sebi_data/attachdocs/feb-2026/1772102397057.pdf) changes physical Gold valuation from 1 April 2026 to exchange polled spot prices. A historical benchmark must account for that methodology change and match the scheme's valuation basis. An arbitrary intraday Gold spot price, converted international price or ETF price series cannot be substituted for that benchmark. No benchmark adapter or timestamped depth fix is claimed in this update.
