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


## Annual exchange filing located after the initial coverage release

The [NSE consolidated FY26 filing](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_153832_28042026202149_iXBRL_WEB.html) is accessible as structured page text, unlike the large issuer PDF. Its identity, annual period, consolidated basis and INR-lakh scale can be inspected directly. The nearby [standalone filing](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_153847_28042026202410_iXBRL_WEB.html) must not be substituted just because its ticker and period match.

The consolidated filing reports annual diluted EPS 0.39 INR/share; the saved provider row labelled EPS in Rs is 0.38. The provider's EPS definition and share-adjustment basis remain unresolved. This is not proof of an incorrect filing or a provider error. Numerical closeness cannot establish matching metric definitions. Rounding reconciliation now compares stated decimal rounding intervals exactly with integer arithmetic, never an extra percentage tolerance.

The annual statement also exposes explicit cash-flow lines and cash balances, so primary-source augmentation is a viable next step. A discovered URL and human inspection are not a verified automatic filing adapter or a complete historical audit. Source publication/restatement availability still needs an explicit contract; the board date and URL timestamp are not automatically publication times.


## Reproducible raw-source inspection

scripts/radar/filing-probe.mjs and source-samples.json define a single reviewed public filing sample. The separate Public filing source sample workflow runs only on source-probe changes or explicit workflow dispatch. It uses no provider/application credentials or user records, permits only fixed-shape NSE archive HTML URLs, refuses redirects, requires HTML and the expected security marker, and bounds reads to 4 MB/15 seconds. An HTML sample, source URL, byte hash and safe failure diagnostics are kept as a one-day artifact. No returned HTML is executed. A security marker alone does not verify a parsed company field, financial fact or publication time. The probe metadata explicitly keeps parserVerified and publicationTimeVerified false.

Inspect the artifact before implementing a source parser. CI network success is not proof of financial coverage or investment performance. The ordinary application checks remain a separate workflow; a source-access failure does not change existing financial records.


## Verified CI result and current handoff

[Public source probe run 44157374922](https://github.com/amanbaid99/financeTracker/actions/runs/44157374922) completed successfully for commit c044e26. It created artifact 14362820070, public-filing-source-sample, with one-day retention. This verifies that the runner fetched and bounded a real public source response, not that the financial parser is implemented.

The downloaded file reference could not be retrieved into the workspace: its enforced revision-5 network policy excludes the NSE archive and the file-download host. The request to enable network access was interrupted, and a read-only status check confirmed that it had not taken effect. No alternative data-transfer route should be used to bypass that policy. The source sample must be obtained through approved network access or supplied as an approved local file before implementing and verifying a parser against its real format. The existing app, report coverage and paper gate remain deployed. No credentials were retrieved and no hosted portfolio/snapshot records were modified.


## Approved uploaded copy and deterministic parsing, 18 Nov 2026

The owner uploaded a 23-page browser-printed copy of the referenced consolidated annual filing. Its PDF SHA-256 is 04f1f7b7bece597cec5bf28e23920452d279d26f272b42f62b42319afa559d8a. The copy unblocks local review while network access remains restricted. The uploaded file and full extracted text are not committed.

api/_radarfiling.py uses native PDF text extraction and deterministic section/column matching. It extracted 14 facts with no issues from this copy. It selects the audited annual column from explicit start/end dates; a fourth-quarter reporting header is not mistaken for the annual duration. It confines results to their main statement, excluding notes/segment revenue, and keeps balance and cash-flow scopes distinct. Currency and per-section scales must match; monetary values use exact decimal normalization. Basic and diluted EPS remain separate per-share facts. Printing time, board date and retrieval time do not establish publication time. Gross PPE purchases are not renamed total capex, and no cash/debt/EBITDA assumptions are silently filled.

| Metric | Saved provider value | Filing value | Comparison |
| --- | --- | --- | --- |
| Revenue | 54,364 | 54,36,400 lakh | Numerically equal if provider scale is crore |
| Net profit | 366 | 36,600 lakh | Same conditional equality |
| Operating cash | 632 | 63,200 lakh | Same conditional equality |
| Total assets | 40,722 | 40,73,600 lakh | Does not reconcile under that assumption |
| EPS | 0.38, definition unspecified | Basic 0.40; diluted 0.39 | Definitions/adjustments need review |

This does not verify every provider metric, historical period or rounding increment. The PDF copy alone does not authenticate its origin. Parser flags for authenticity, publication, recurring earnings, comparable accounting and valuation readiness remain false. No Buy/Hold/Sell result is released.

The HTML adapter flattens document structure without executing scripts or fetching embedded resources. The CI review step checks the source hash, configured identity, period/basis and six facts corroborated by this copy. Successful sample assertions establish that source/template path only, not all NSE formats or investment-model validity. Future live ingestion must bind the parsed facts to the approved network fetch, preserve actual availability evidence and pass source/model validation. No new public parsing endpoint is added by this module.
