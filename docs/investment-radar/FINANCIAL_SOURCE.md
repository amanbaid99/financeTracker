# Optional company financial data, 17 Nov 2026

## Source decision

The existing integration supplies INDstocks market data and AMFI/MFapi NAV. A separate financial-statement source is needed for stock research. The optional IndianAPI starter adapter is prepared; it has not been authenticated or sample-verified from this workspace. A configured key or successful Vercel build is not proof of company coverage.

Provider documentation describes a free starter account with 500 initial API credits, the Free/Hobby host stock.indianapi.in, X-Api-Key authentication and GET /stock plus GET /historical_stats. Credit replenishment and plan eligibility must be checked in the current provider dashboard; no monthly quota or complete dataset coverage is assumed. No paid subscription is selected or purchased.

References:

- [Current first-call guide](https://indianapi.in/blog/get-your-api-key-and-make-your-first-call)
- [Stock and historical-stat endpoint documentation](https://indianapi.in/documentation/indian-stock-market)
- [Account, plans and key management](https://indianapi.in/indian-stock-market)

## Prepared flow

1. The owner saves INDIANAPI_KEY directly as a Vercel Secret for Production and redeploys. No secret is retrieved or printed, and no key is sent to INDstocks or the browser.
2. An explicit Refresh research on a verified stock resolves the current NSE symbol. For BSE, the instrument master must identify one NSE counterpart with the same ISIN. No fuzzy company-name match is allowed.
3. GET /stock must return an exact tickerId match. Missing or different identity stops all report requests. Only industry metadata is retained from this large response; raw financial duplicates, names of peers/officers, analyst recommendations and news are discarded.
4. Up to three concurrent historical_stats reads request yoy_results, balancesheet and cashflow. Tables keep metric labels, valid completed month-end periods and finite numeric/null source figures. Future and undated/TTM periods are excluded and recorded. Unsupported numeric formats fail the affected report rather than inferring units.
5. Successful tables survive independent report failures. Financial-data failures do not prevent current market evidence being saved. Exact source URLs, canonical ticker, retrieval time and report coverage remain in immutable snapshots. Reuse under 24 hours requires the same symbol and a valid nonfuture retrieval time; the old timestamp is never rewritten as new.
6. The folded Company reports section shows coverage and retrieval information. Fiscal period ends are not publication dates, and no financial figures are shown as verified rupee amounts or fed into valuation scoring.

Requests are fixed-host, GET-only, reject redirects, time out after 12 seconds and cap responses at 2 MB. Auth, plan, quota, malformed/HTTP-200 error-body and source failures use controlled messages, never upstream text or credential-bearing headers. At most four requests occur per collection; a failed collection may be retried by a later explicit refresh. There are no automatic paid upgrades or background ingestion jobs.

## What this source does not prove

The public examples do not establish independent ISIN matching, consistent financial units/currency, consolidation basis, actual publication/restatement times, point-in-time peer valuations or full sector/model support. All corresponding verification flags and researchReady stay false. A table's period end cannot become a filing date. Report collection is distinct from a tested stock assessment.

It also does not establish adjusted-price semantics, a verified dated order book, ETF benchmark mapping, MCX polled-price history or ETF tracking inputs. There is no fallback to another company's data, a Gold model or copied provider analyst ratings.

## Other documented candidates reviewed

- [Global Datafeeds corporate-data coverage](https://docs.globaldatafeeds.in/type-of-corporate-data-available-1142925m0) documents report/action APIs but lists short history for some categories. Full required history and sample payloads need confirmation before choosing it for validation.
- [TrueData API offerings](https://www.truedata.in/products/marketdataapi) describe market and corporate-data products. A desktop/plugin adjustment claim does not by itself establish the REST API's adjustment convention, required corporate-data package or MCX polled-spot coverage.
- [EODHD fundamental documentation](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) documents fundamental services, but per-instrument Indian coverage, required plan and exact ETF/benchmark fields were not verified here.

No paid provider above was installed, contacted, subscribed or represented as a complete solution. The free starter path is for obtaining and inspecting real stock-report samples before committing to another service.

## Next verification

After the key is configured and a selected stock is explicitly refreshed, inspect the stored source identity and one sample of each successful report. Confirm units, currency, consolidated/standalone basis and publication-date availability against company filings or provider documentation before building canonical valuation inputs. If those fields are not supplied, retain the blockers and obtain a suitable source rather than inventing them. Historical validation and live paper monitoring remain necessary before releasing Buy/Hold/Sell decisions.
