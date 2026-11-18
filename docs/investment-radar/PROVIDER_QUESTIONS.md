# Exact source questions before the next research milestone

Prepared 17 Nov 2026. These are drafts for the owner to use if provider clarification is needed. Nothing has been sent to any provider. Never include an access token, TOTP seed, PAN or account information in a reply shared here.

## INDstocks support

We use the market-data API for a personal end-of-day research tool. We do not place orders or read broker account data.

1. Does GET /market/historical/1day return raw or adjusted NSE/BSE ETF OHLCV? Please specify split, consolidation, bonus and distribution treatment, which fields are adjusted, adjustment-factor availability and whether history is revised.
2. Does GET /market/quotes/mkt expose an actual order-book event/publication timestamp? If not, does WebSocket quote mode provide depth and a documented timestamp for that book? Please provide the payload schema, units, timezone and freshness semantics. An LTP timestamp is not sufficient for a depth check.
3. What does the depth endpoint return when the exchange is closed, there are no active orders or a subscription lacks depth access? How can those cases be distinguished from an invalid instrument or request limit?
4. Is a dated end-of-session book snapshot available for end-of-day research after market close? If yes, please identify its endpoint, session/date convention and timestamp semantics. A current intraday book cannot be silently substituted for a previous close.
5. Can your market-data API provide MCX 995-purity Gold polled spot history, as distinct from commodity futures? If yes, please provide coverage, quote units, currency, location, polling/valuation session, timestamps and access requirements.

A documented response and a public-instrument sample payload are needed. Credentials are not needed in the shared example.

## MCX or a documented spot-data supplier

We need daily historical polled spot prices for 995-purity domestic Gold used for mutual-fund valuation, not futures settlement or an international spot conversion.

Please confirm:

- The exact public or licensed download/API contract and available history.
- INR price units, purity, location, polling-session selection and publication timestamps.
- Treatment of non-equity trading days, revised observations and missing polls.
- Whether history crosses the 1 April 2026 valuation-method change consistently, or requires separate series/regimes.
- Permitted access for one personal research account, with no redistribution.

The selected AMC's published policy designates MCX but allows committee-approved fallback valuation. We still need to match the actual scheme methodology and cannot assume every MCX spot row is the right benchmark.

## Stock, index and other ETF data suppliers

The common data path must support individual NSE/BSE stocks and ETFs, not only Gold. Please specify:

- Stock annual/quarterly financial statements, publication and restatement dates, cash flow, shares/capital changes, sector identity and valuation history. Point-in-time data must distinguish when information became available from the period it describes.
- Financial-sector coverage. Banks and NBFCs need sector-specific metrics and cannot use industrial debt/cash-flow rules blindly.
- Exact ETF-to-underlying mapping, official index history, valuation measures and publication dates, benchmark total-return conventions, tracking data and expenses.
- Distinct coverage for debt, Silver, sector and international-exposure ETFs if supplied. Gold factors are not a substitute for their own yield, credit, commodity, sector or currency risks.
- Adjusted-price and timestamp conventions, source revision policies and the actual access contract for each dataset.

## What this unlocks

Once documented, sample-verified data access is available, connect the fixed-host adapter, reconcile overlapping source dates/values and retain provenance. Then run the unchanged Gold paper model on real point-in-time data and compare it with the existing monthly, immediate and simple-dip baselines. Unit tests and source-count agreement alone do not release investment recommendations.

## Documentation recheck, 18 Nov 2026

The [INDstocks changelog](https://api-docs.indstocks.com/changelog/) migration note says history gained an adjusted-price field. The [current historical contract](https://api-docs.indstocks.com/historicalData/) documents ts/o/h/l/c/v, but does not identify that field or its adjustment rules. Ask for the exact field, split/bonus/consolidation/distribution semantics and a public sample. Do not infer adjustments from this changelog sentence or silently reinterpret c as adjusted close.

The [IndianAPI report examples](https://indianapi.in/documentation/indian-stock-market) do not resolve the selected source's EPS definition, period-specific consolidation/restatement basis or the asset discrepancy against the reviewed filing. These questions remain open. No support message has been sent.
