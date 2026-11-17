# Optional company financial data, 17 Nov 2026

## Source decision

The existing integration supplies INDstocks market data and AMFI/MFapi NAV. A separate financial-statement source is needed for stock research. The optional IndianAPI starter adapter has now collected all three report tables for the selected stock, confirmed read-only from its saved engine 0.9 snapshot. The production key was not retrieved into this workspace. A configured key or successful Vercel build is not proof of company coverage.

Provider documentation describes a free starter account with 500 initial API credits, the Free/Hobby host stock.indianapi.in, X-Api-Key authentication and GET /stock plus GET /historical_stats. Credit replenishment and plan eligibility must be checked in the current provider dashboard; no monthly quota or complete dataset coverage is assumed. No paid subscription is selected or purchased.

References:

- [Current first-call guide](https://indianapi.in/blog/get-your-api-key-and-make-your-first-call)
- [Stock and historical-stat endpoint documentation](https://indianapi.in/documentation/indian-stock-market)
- [Account, plans and key management](https://indianapi.in/indian-stock-market)

## Prepared flow

1. The owner saves INDIANAPI_KEY directly as a Vercel Secret for Production and redeploys. No secret is retrieved or printed, and no key is sent to INDstocks or the browser.
2. An explicit Refresh research on a verified stock resolves the current NSE symbol. For BSE, the instrument master must identify one NSE counterpart with the same ISIN. No fuzzy company-name match is allowed.
3. GET /stock uses the documented symbol query. A matching companyProfile.isInId can prove cross-source security identity against the selected instrument even when tickerId is absent or changed. Conflicting or malformed source ISIN stops collection. Without ISIN proof, a direct exact tickerId match is accepted. An internal S-prefixed numeric ID instead requires GET /industry_search with the same public symbol; exchangeCodeNsi must match the exact NSE symbol and identify one unique ID equal to the stock response. Company names are ignored, stale aliases and ambiguous mappings fail, and no report is fetched without this proof. Identity method, matched ISIN when applicable, provider ID and industry metadata are retained; raw financial duplicates, names of peers/officers, analyst recommendations and news are discarded.
4. Up to three concurrent historical_stats reads request yoy_results, balancesheet and cashflow. Tables keep metric labels, valid completed month-end periods and finite numeric/null source figures. Future and undated/TTM periods are excluded and recorded. Unsupported numeric formats fail the affected report rather than inferring units.
5. Successful tables survive independent report failures. Financial-data failures do not prevent current market evidence being saved. Exact source URLs, canonical ticker, retrieval time and report coverage remain in immutable snapshots. Reuse under 24 hours requires the same symbol and a valid nonfuture retrieval time; the old timestamp is never rewritten as new.
6. The folded Company reports section shows coverage and retrieval information. Fiscal period ends are not publication dates, and no financial figures are shown as verified rupee amounts or fed into valuation scoring.

Requests are fixed-host, GET-only, reject redirects, time out after 12 seconds and cap responses at 2 MB. Auth, plan, quota, malformed/HTTP-200 error-body and source failures use controlled messages, never upstream text or credential-bearing headers. At most five requests occur per collection; a failed collection may be retried by a later explicit refresh. There are no automatic paid upgrades or background ingestion jobs.

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


## Internal-ID correction, 17 Nov 2026

The first live ETERNAL screenshot failed the original tickerId-equals-symbol assumption. The provider's public endpoint documentation separately exposes directory id and exchangeCodeNsi; the current first-call guide supports symbol queries. The adapter now uses those contracts for an exact cross-check, without treating internal IDs as exchange symbols or guessing renamed-company aliases. Optional industry metadata is parsed separately so a changed industry shape cannot masquerade as identity failure. This path has synthetic regression tests; live coverage, successful ETERNAL mapping and report availability still need the owner's explicit refresh. No production secret is retrieved and no user snapshot is written from the workspace.

Next milestone: verify a real successful report collection, check its units/basis/publication metadata against filings, then implement canonical stock valuation inputs and a paper model. Provider analyst ratings are not copied into Buy/Hold/Sell.


## Missing ticker ID and safe shape diagnostics, 17 Nov 2026

The owner refreshed ETERNAL on engine 0.8. A read-only snapshot check confirmed the response had no usable tickerId and no reports were requested. The earlier internal-ID fix therefore did not resolve this live response. The provider's public current guide does not guarantee tickerId in all payloads. Optional profile ISIN parsing is now supported: the value must be a valid exact match with the selected IND instrument's ISIN. This is a cross-source security match, not an independent official-filing identity audit; isinVerified and all financial-quality flags stay false. The optional field's actual presence and shape in this live response remain unconfirmed until an explicit refresh. No company-name or renamed-symbol guess is introduced.

When identity fails, the error carries only a static allowlist of response-field types. The next explicitly confirmed snapshot can save that diagnostic in analysis.financialsIdentityShape and include it in the input hash. No raw values, profile/officer/peer information, upstream messages, secrets or arbitrary source field names enter the diagnostic. Existing records are not changed. Same-ISIN evidence reuse additionally requires the same expected ISIN. UI and research checks distinguish an ISIN match from an NSE ticker match.


## First live collection verified

A read-only snapshot check confirmed ETERNAL at 2026-11-17T18:28:20Z, engine 0.9: same-ISIN identity, no source errors, nine annual periods through March 2026, ten balance periods through September 2026 and seven cash-flow periods through March 2026. Seven exact annual ends overlap. This verifies one selected stock's collection, not every issuer or financial-quality flag. The source's reported industry is not evidence of model eligibility.

The report-coverage helper now aligns exact period ends and flags absent, ambiguous and incomplete metric rows. It never turns Operating Profit into EBITDA, investing cash flow or free cash flow into capital spending, or investments/other assets into cash. A newer interim balance cannot be paired with an older annual cash-flow statement as if they were one period. Coverage never sets valuationReady.

See STOCK_SOURCE_AUDIT.md for primary filing references and the accounting-comparability finding. The paper contract requires separate positive accounting-comparability and recurring-earnings review. The financial-reconciliation helper compares explicitly verified same-identity/period/basis observations with INR/lakh/crore conversion and stated rounding. EPS, percentages and multiples have separate dimensions and are never scaled by a statement's monetary unit. This is arithmetic for future filing adapters, not an automated filing-ingestion or source-audit claim.
