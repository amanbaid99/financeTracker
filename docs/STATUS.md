# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 18 Nov 2026.

## Reviewed filing comparison, 18 Nov 2026

The real public source CI run 44230631531 passed: the HTML parser extracted 14 facts with no issues and passed the six initially audited sample assertions. The reviewed copy now supplies a small public reference catalog for the selected ISIN, with all 14 facts checked by CI before this stage is considered verified. This is limited explicit reference coverage, not automatic filing discovery for every stock.

A generic source-comparison helper matches exact ISIN, fiscal date and statement rows. The Company reports detail now has a folded Annual filing comparison. Agreements remain conditional on an explicitly assumed crore scale; total assets need review and unspecified EPS is never equated with diluted EPS. Missing/duplicate dates or rows, conflicting dimensions and inconsistent normalized amounts cannot produce a match. All provider/model verification flags remain unchanged. The comparison uses existing collected reports and needs no new refresh, SQL migration or hosted record change. Local verification passed: lint, TypeScript, 458 unit tests, 37 Python tests and the production build. Chromium fixtures passed 180 responsive cases, including 12 filing-comparison views. Full signed-in local e2e remains blocked by the Supabase CLI telemetry write to a read-only home. Deployment and the expanded real-source CI assertions are being checked.

## Uploaded annual filing parser, 18 Nov 2026

The owner supplied an approved local PDF copy of the selected official annual filing. This unblocks direct document review without changing the workspace network policy. The new deterministic _radarfiling.py parser extracted 14 facts from the real 23-page copy with no row issues. It verifies the selected ISIN, dates, currency/scale and reporting basis, chooses the audited full-year column by start/end dates, separates balance/cash-flow sections and normalizes monetary values with Decimal while leaving EPS unscaled. It does not use print/board dates as publication times, execute HTML, send data to AI, retain raw names or enable investment recommendations.

Revenue, net profit and operating cash flow agree with the saved provider rows if the provider's monetary scale is crore. That does not verify its whole dataset or all periods. Reported EPS definitions remain unresolved, and total assets do not reconcile under that same scale assumption. The parser retains issues and accounting warnings; source authenticity, publication, recurring-earnings, accounting-comparability and valuation-readiness flags remain false. The original uploaded PDF/text is not committed. A synthetic fixture covers its logical structure.

The same core has a bounded HTML reader. The public source CI workflow now runs it against the real source and checks selected facts against the reviewed PDF sample, retaining only parsed public evidence in its one-day artifact. Local verification: lint, TypeScript, 449 unit tests, 37 Python tests and production build passed. The real PDF produced 14 facts with no row issues; CI run 44230631531 also passed on the real HTML source, extracting 14 facts with no issues and passing the audited assertions. No new HTTP endpoint, source key or hosted-data mutation is introduced. See investment-radar/STOCK_SOURCE_AUDIT.md.

## Public filing sample verification, 17 Nov 2026

Added a bounded, credential-free public-source probe and a separate GitHub Actions workflow. It only reads an allowlisted NSE integrated-filing URL from a reviewed sample manifest, refuses redirects and unexpected document types, caps the response at 4 MB/15 seconds and checks for the expected public security identifier. The workflow has read-only repository permissions, does not persist checkout credentials and stores only its public sample/diagnostics for one day. It does not read environment variables, production keys, private portfolio records or Supabase data.

This is a source-format inspection tool, not a filing parser or a verification flag. Metadata retains a byte hash and explicitly leaves publication/parser verification false. The CI source read succeeded in run 44157374922 and created public-filing-source-sample artifact 14362820070. The artifact reference was returned, but its download and direct NSE retrieval are blocked by this workspace's enforced network policy (revision 5, package-manager preset only). A network-access request was interrupted; a subsequent status check confirms the source/artifact hosts remain excluded. Do not repeat the interrupted Vercel sandbox route or claim that the raw filing has been inspected locally. The next step requires source download access or an approved local copy of the public artifact. Local verification: lint, TypeScript, 449 unit tests, 18 Python tests and production build passed. Focused probe tests cover permitted source reads, rejected hosts/credentials/query strings, HTML challenges, document types, size limits and safe upstream errors. The previous local signed-in e2e failure remains a tooling blocker, not a reported pass. See investment-radar/STOCK_SOURCE_AUDIT.md.

## Annual filing definition review, 17 Nov 2026

Located the selected stock's official consolidated FY26 exchange filing in readable page form. The nearby standalone filing is explicitly different and cannot be merged into consolidated data. Annual diluted EPS in the filing and the provider's reported EPS differ; their definitions/adjustment bases are unresolved, so no EPS comparison or valuation is promoted to verified. The monetary reconciliation helper now compares declared decimal rounding intervals with exact integer arithmetic while still rejecting different metric definitions and values beyond that boundary. No source flag or live recommendation is enabled. See investment-radar/STOCK_SOURCE_AUDIT.md. Verification: lint, TypeScript, 441 unit tests, 18 Python tests and production build passed. The focused reconciliation tests cover decimal boundaries, large amounts, incompatible EPS definitions and genuine mismatches. The prior full signed-in e2e attempt remains blocked by local Supabase tooling. No live research release is claimed.

## Live stock reports and comparability checks, 17 Nov 2026

The owner refreshed successfully: ETERNAL engine 0.9 collected nine annual, ten balance and seven cash-flow periods with an exact source-profile ISIN match and no errors. Latest annual/cash-flow dates are March 2026; the latest balance is September 2026. Seven year ends overlap. No source key was retrieved. This closes the first live collection blocker for this stock only.

Added generic structural coverage checks for shared annual periods and absent, incomplete or ambiguous financial rows. The UI explains those gaps inside Company reports. Cash balance, capital spending and explicitly defined EBITDA are absent from the current tables and are never inferred from other assets, investing cash flow, FCF or Operating Profit. Raw coverage never unlocks valuation.

Primary issuer and exchange reporting documents a move to inventory-led revenue recognition. The paper model now requires independent positive accounting-comparability and recurring-earnings review before scoring; reported revenue expansion alone cannot pass. A new reconciliation helper handles explicitly verified same-security/period/basis facts, INR/lakh/crore scaling, unscaled EPS/percentages and declared rounding. No primary-filing adapter or independent full audit is claimed. See investment-radar/STOCK_SOURCE_AUDIT.md. Verification: lint, TypeScript, 439 unit tests, 18 Python tests and production build passed. Chromium fixtures passed 168 responsive cases plus 12 report-coverage views. Full signed-in e2e remains blocked by the Supabase CLI telemetry write to a read-only home. Public filing downloads were limited by workspace access and a large-PDF tool cap; the Vercel Sandbox attempt was interrupted and returned no filing files. No full automated primary-filing audit is claimed.

## Source-profile ISIN and identity diagnostics, 17 Nov 2026

The owner's refreshed ETERNAL snapshot reached engine 0.8 but returned no usable tickerId, so reports were not requested. The adapter now accepts an optional valid profile ISIN only when it exactly matches the selected instrument's ISIN. Conflicting or malformed ISIN stops collection even if a ticker matches. Existing ticker and directory paths remain available without ISIN proof. Reused ISIN-matched evidence must retain the same expected ISIN. This establishes a cross-source match, not independent filing identity or verified financial metadata.

Failed identity checks retain only allowlisted field types, never field values, arbitrary field names, raw profiles or credentials. That shape is included in a future explicitly refreshed snapshot and its input hash. No existing hosted record is rewritten and no schema migration is needed. Source ISIN presence and report coverage remain unverified live until refresh. The paper model and production recommendation lock remain unchanged. Validation: lint, TypeScript, 412 unit tests, 18 Python tests and production build passed. Chromium component fixtures passed 168 responsive cases plus 12 cross-source ISIN collection views. Full signed-in local e2e remains blocked by the Supabase CLI telemetry write to a read-only home. No fixture is claimed as live provider coverage.

## First stock paper assessment, 17 Nov 2026

Implemented lib/radar/stock-model.ts for a limited profitable non-financial model. Its strict canonical input contract requires matching ISIN, verified eligibility/units/currency/basis, normalized recurring diluted adjusted EPS, actual report/valuation availability times, ordered annual periods, current comparable peers and dated historical P/E. Corporate-action verification, session/date freshness and financial calculations fail closed. Raw IndianAPI tables cannot satisfy this contract and are never silently promoted to canonical sources.

The paper screen implements the PRD 30/30/20/20 weights and transparent proposed risk gates for cash generation, leverage and relative valuation. All thresholds remain experimental. Financial/unsupported sectors and negative/nonpositive earnings need different models. The assessment is exposed only as missing-input/testing information in folded research details. A passing paper candidate cannot change the live Research not ready label or null score. Hold/exit assessment, validated source normalization, real historical evaluation including survivorship, and live monitoring remain unfinished.

Read-only hosted verification found ETERNAL still on the previous 0.6 snapshot with no reports. The 0.7 source fix has not yet been verified by an explicit owner refresh. No hosted user record was changed. Validation: lint, TypeScript, 403 unit tests, 18 Python tests and production build passed. Chromium component fixtures passed 168 responsive theme/width/state cases plus 12 expanded stock-model views. The signed-in local e2e remains blocked by Supabase CLI telemetry writes to a read-only home. All source/model fixtures are synthetic, not live coverage or performance evidence. See investment-radar/STOCK_MODEL.md.

## Stock source identity correction, 17 Nov 2026

The adapter now sends the documented symbol query rather than a fuzzy name search. Direct exact ticker IDs still pass; internal S-prefixed numeric IDs require a documented industry_search directory response with one exact exchangeCodeNsi mapping back to the same ID. Names, stale symbols, missing or conflicting mappings never authorize report reads. Industry shape changes are separated from identity checks. Evidence records the identity method and internal ID, not raw company profiles. New collections use at most five reads. Reports, source errors and unfinished valuation/model work are distinguished in the automatic research card. No schema migration, background collection or hosted record mutation is added.

This corrects a source-contract assumption, not a claim that ETERNAL has now passed a live check. The production key stays in Vercel; the next explicit owner refresh must verify the source path. Financial metadata, stock and index models, Gold benchmark inputs, historical validation and live paper monitoring still block Buy/Hold/Sell. See investment-radar/FINANCIAL_SOURCE.md.

Verification: lint, TypeScript, 381 unit tests, 18 Python tests and production build passed. Chromium component fixtures passed 168 responsive theme/width/state cases, plus the internal-ID directory-match collection view. Full signed-in local e2e remains blocked by the Supabase CLI telemetry write to a read-only home. These tests use synthetic source responses, not a live financial-source success.

## Bottom navigation isolation, 17 Nov 2026

The owner reported bottom controls covering expanded Radar company reports on an iPhone. AppTabs now portals its navigation and floating action to document.body after hydration, avoiding page-container fixed-position containing blocks. Its background is opaque and no longer uses a backdrop-filter layer. Existing safe-area spacing and content bottom padding are preserved. Failed company-report requests now distinguish a configured key from verified coverage rather than suggesting an immediate repeat refresh. No identity guard is relaxed.

The exact iPhone failure has not been reproduced. WebKit installation failed in this environment. Chromium passed 108 dock geometry checks across transformed ancestors, expanded reports, scrolling and viewport resizing. Lint, TypeScript, 371 unit tests, 18 Python tests and production build passed. Full signed-in e2e remains blocked by the Supabase CLI telemetry write to a read-only home. The live screenshot shows ETERNAL failing the financial-source identity contract; that source integration remains unresolved, and no Buy/Hold/Sell capability is claimed.

## Optional stock financial-report source, 17 Nov 2026

Prepared an IndianAPI starter-tier adapter for exact NSE ticker identity, annual results, balance sheets and cash flow. BSE instruments need one same-ISIN NSE counterpart. An explicit verified-stock refresh collects reports only when the separate INDIANAPI_KEY is configured server-side. It makes at most four source reads, retains partial report successes and reuses successful/partial collections under 24 hours with the original retrieval timestamp. Financial-source errors preserve the current market evidence. Raw profiles, peer/officer details, analyst recommendations and news are discarded. No paid plan is purchased, no secret is retrieved and no background collection or schema migration is added.

The folded Company reports UI shows table/period coverage, not unverified-unit financial figures. Source configuration alone does not establish access or coverage. Stock publication times, units/currency, consolidation basis, independent ISIN checks, peer valuations and sector models remain incomplete; reports never unlock valuation scoring or Buy/Hold/Sell. ETF benchmarks, price adjustments and book timestamp coverage remain separate blockers. The owner has configured the key and redeployed. The first live stock check failed identity validation; report coverage remains unverified. See investment-radar/FINANCIAL_SOURCE.md and docs/SETUP.md.

Verification: lint, TypeScript, 371 unit tests, 18 Python tests and production build passed. Browser component fixtures passed 168 responsive theme/width/state cases including collected, partial, rejected-key and unconfigured company reports. The full signed-in local e2e still fails on the Supabase CLI read-only telemetry path. No real IndianAPI response or paid-provider coverage is claimed from fixtures.

## Multi-asset source diagnostics, 17 Nov 2026

The live Gold snapshot was checked read-only: 374 price records and 373 NAV observations contain 371 matching dates, three price-only and two NAV-only dates. One NAV-only date precedes the price window. The expanded NAV history now exposes exact date reconciliation without changing existing records, filling gaps or pairing by row number. The screenshot plus hosted snapshot confirms this NAV-history data path, not every asset or source.

Shared dedicated depth reads now apply to stocks and ETFs. New snapshots distinguish no active two-sided book, invalid/crossed data, access denial, request limits and source failure. Old generic failures remain unknown. REST market timestamps are still unverified. Stocks collect depth without requesting NAV. Other ETFs retain available ETF data and a model-unavailable label, use other_etf analysis inputs, and cannot fall into stock/Gold models or bypass optional entry checks using a legacy stock tag. No schema migration or background mutation of existing hosted user records is needed.

The selected Gold ETF's published valuation policy identifies MCX polled spot prices as its designated source, rather than an automatically interchangeable NSE series. Matching archive payload/session metadata and historical methodology remain unverified. Stock fundamentals/sector models, index valuation/history, other ETF models, adjusted history, dated book coverage and validated Buy/Hold/Sell decisions remain unfinished. See investment-radar/ASSET_COVERAGE.md, DATA_REQUIREMENTS.md and the unsent provider question draft PROVIDER_QUESTIONS.md.

Validation: lint, TypeScript, 347 unit tests, 18 Python tests and production build passed. Browser fixtures passed 120 responsive theme/width/state cases, including stocks, index/Gold/unsupported ETFs, unmatched dates, empty books and denied access. The full signed-in local e2e remains blocked by the Supabase CLI telemetry write to a read-only home. No synthetic source test is represented as live coverage or investment-performance evidence.

## Historical NAV data path, 17 Nov 2026

Refresh research now attempts a free secondary NAV-history read from MFapi after obtaining official same-session AMFI NAV. Exact scheme code and ISIN must match; the latest historical point is reconciled with the official value. The optional Published NAV history chart labels provenance, coverage and unverified publication/adjustment status. A failed history request preserves the independent current-price, official-NAV and depth results. No extra key, schema change or background write to an existing user record is required.

This is an integrated source path, not proof of live retrieval or completed investment research. Direct source requests from this workspace returned proxy HTTP 403, so authenticated production/source coverage remains unverified. The secondary history has no publication times or adjustment assurance and never populates GoldSources. An official NSE spot-history page and the April 2026 valuation-method change were identified; the matching benchmark payload adapter, adjusted history and dated depth are still blocked. Buy/Hold/Sell and real-data model validation remain unfinished. See investment-radar/DATA_REQUIREMENTS.md.

Validation: lint, TypeScript, 319 unit tests, 18 Python tests and the production build passed. Browser component fixtures passed 72 responsive cases including historical-NAV expansion. The full signed-in local e2e remains blocked by Supabase CLI telemetry writes on a read-only home. No fixture or build is reported as proof of live market-data coverage.

## Gold paper work, 17 Nov 2026

Implemented a first deterministic Gold assessment model, source-contract validation and a point-in-time replay harness comparing model, monthly, immediate and simple-dip policies with equal cash availability and explicit costs. These are paper/testing tools, not production Buy/Hold/Sell recommendations. Real historical inputs, source adapters, out-of-sample evaluation and live paper monitoring remain incomplete. Hold and exit logic remain unfinished.

The readiness UI now separates missing source connections from model development and testing. Research not ready describes those blockers; missing latest-session prices remain Insufficient data. Refresh cannot finish model work. See [the exact data requirements](investment-radar/DATA_REQUIREMENTS.md) for source findings, proposed model parameters and remaining release checks. No new paid provider, schema migration or hosted user-record changes are included.

Checks: 298 unit tests, 18 Python tests, lint, TypeScript and production build passed. Browser component fixtures passed 60 responsive theme/width/state cases. Full local signed-in e2e remains blocked by the Supabase CLI telemetry write to a read-only home. Synthetic tests do not demonstrate investment performance or live API coverage.

## Radar update, 17 Nov 2026

Automatic research is now the primary detail and watchlist assessment. It runs without manual price rules. Optional manual alerts are folded separately and use entry/exit alert wording. Existing ETF classifications are corrected at read time from instrument metadata or exact AMFI ISIN evidence, without rewriting saved watchlist records. NSE and BSE completed-session checks cover the verified remainder of 2026.

This is an evidence readiness and risk review, not a finished recommendation model. Verified NAV premium or spread risks can produce Wait. Missing adjusted history, benchmark context, valuation and validated models continue to produce Insufficient data. Buy/Hold/Review selling are not yet generated by a validated production model. Undocumented broker quote timestamps never establish freshness. No schema migration is needed.

Validation: 275 unit tests, 18 Python tests and production build passed; 60 responsive fixture browser cases passed across three themes and four widths. Local signed-in end-to-end testing is blocked by the Supabase CLI attempting to write telemetry on a read-only filesystem. Live broker credentials were not used in fixture verification.

## Live (deployed from `claude/cool-davinci-9zjka6` to Vercel, region bom1)

- **Goals** (start page): summary card, one Next step card when there's something to do,
  goals grouped by when they're due with Must have / Nice to have, the goal calculator ("Not
  sure? Work it out", AI cost estimates), budget (plan only), and the money plan on its own page
  (`/goals/plan`) with where it goes and why, plus the This month SIP checklist. "I have extra
  money" from +.
- **Between jobs**: salary dates turn on "On hold till salary" for savings goals and the
  "Covered till salary" page (`/goals/salary`: money you can reach vs EMIs, living costs and
  bills till each salary date, weekly amount). Your plan (`/goals/plan`) shows the split, with
  Edit order (`/goals/order`). Budget is its own tab (`/goals/budget`), with Covered till salary at the top while between
  jobs and a calm note instead of a deficit while there's no income.
  Goals is just the goals. Every goal shows in one list in plan order (`lib/goal-order.ts`):
  "Focus on these first" (top three), then "Everything else". Nothing is folded. Loans are goals:
  monthly lender balance confirmations; confirmed balances stay until the next update. Older unconfirmed balances remain schedule estimates. Loan cards show repaid of
  withdrawn (or what's left) and the end date, plus a second bar when saving to close early.
- **Net worth** tab (`/assets`, was Assets and Portfolio): net worth today (holdings minus loans),
  What you owe (each loan with balance and repaid, linking to its goal, `components/owe-list.tsx`), linking to `/assets/net-worth` (three
  charts, own by asset type, owe by loan), allocation by asset type or instrument, holdings with
  search and sort, portfolio review (hidden for now, commented out in `app/(app)/assets/page.tsx`), CAS import with review, withdrawal check and insights.
- **Cards** (`/cards`): statements logged for milestones only, never as money owed, milestones,
  which card to use. Milestone targets, amounts left and deadlines are visible without expanding; cards with every milestone reached sort below the rest and return when their period resets. Liabilities was removed on 17 Nov 2026; old URLs redirect (`next.config.ts`).
- **Ask**: private Q&A (codes only to AI), amount questions split by the app's own planner.
- **Settings**: look, invites (admin), Ask on/off, Help and guides (Help page, What's new archive,
  Take the tour, show guides again), account and delete.
- **App shell**: bottom bar (Goals, Net worth, +, Budget, Cards), Ask and Settings in the header, Back to the exact previous screen,
  error screens with Try again, offline page via a service worker, toasts with Undo, drafts for
  new goals and loans, first-visit guides, What's new with "Show me around".
- **Checks**: GitHub Action runs lint, typecheck, unit and Python tests on every push.

## Open

- Card statement analysis (owner's idea, see DECISIONS "Later").
- "Request my CAS" via CAS Parser's CAS Generator: needs the owner's yes and an API key in Vercel
  (`CAS_PARSER_API_KEY`). It would send the registered email to a third party.
- Ideas offered, not built: export all data (CSV/JSON), soft delete with undo for deletes and
  imports, goal and loan progress charts, a feedback form, a /demo route, analytics.

## Known gaps


- The security (RLS) and end-to-end tests need a local Supabase stack, so CI doesn't run them;
  run them locally before pushing (AGENTS.md).
- Hosted migrations sometimes time out waiting for approval through the Supabase MCP; the owner
  then runs the SQL in the dashboard. The hosted migration history may lack those entries.
- Card bills still have `due_date` and `paid` columns; nothing reads them now.
- Deletes are permanent (no soft delete), and imports can't be undone as one unit.
- Net worth history starts on 6 Nov 2026 and only records days when something changed.

## Latest changes: monthly updates

- Goals shows one Updates due item at a time. Card statement dates are configurable in Edit card; reminders open the right card and month. Loans ask for monthly confirmation from the 2nd; mutual fund holders get a CAS reminder from the 5th. Legacy card payment flags and removed one-off payment records are ignored. Remind me tomorrow is stored per item across devices.
- Confirmed loan balances do not amortise automatically. Loan details show the confirmation date, optional borrowed amount and principal repaid. Schedule-based balances and future payoff figures are labelled estimates. A zero balance closes the monthly reminder.
- CAS confirmation includes invested-only changes and withdrawal adjustments. An unchanged import can still be confirmed to record a monthly refresh. Missing CAS cost preserves the existing cost.

- Verification: lint, TypeScript, unit and Python checks, production build and 36 component browser checks across 320/375/768/1024px and three themes. Hosted migration applied; new RPC and snapshot use invoker security, with an isolated foreign-subject query confirming no access to settings or loans. Full signed-in e2e and local type generation remain blocked by the Supabase CLI writing telemetry to a read-only home directory. Added two-user snooze isolation coverage for the next local RLS run.

## Investment Radar foundation (17 Nov 2026)

- Personal-only Radar tab with INDmoney instrument lookup, confirmed watchlist additions, daily price-history refresh, closing-price charts, provisional technical indicators and saved thresholds. Owner gets five tabs with a floating plus; other users keep their current navigation.
- Dedicated entitlement, watchlist and immutable snapshot tables have RLS and composite ownership checks. Hosted migration applied; rollback-only two-user SQL checks passed without persisted test records.
- Signals remain Insufficient Data, with no score. Exchange-calendar freshness, corporate-action adjustments, fundamentals, sector models, ETF NAV/tracking and index inputs need verification before balanced scoring. Scheduled monitoring, Telegram and backtesting are not enabled. This is the first foundation, not the full PRD.
- INDSTOCKS_ACCESS_TOKEN is server-only in Vercel. The owner configured it directly; development did not retrieve it. Live account/provider coverage has not yet been exercised. See docs/investment-radar/INTEGRATION.md and the supplied PRD for scope and remaining work.
- Verification: lint, TypeScript, 245 unit tests, 18 Python tests, production build and 48 responsive component-fixture cases passed. Full signed-in local e2e remains blocked by Supabase CLI telemetry writing to a read-only home directory. CLI type generation was also blocked; migration types were reconciled manually and typechecked.

## Radar price-rule signals and ETF evidence (17 Nov 2026)

- Explicitly enabled price rules show dated Buy/Hold/Sell/Wait/No signal cards on details and watchlist. Sell requires confirmed ownership plus a saved upper/lower exit. Exits take priority. Hold only means configured exit levels did not trigger. These are user rules, not full research recommendations. Existing records stay opted out.
- ETF refresh matches official AMFI NAV by exact ISIN and reads INDmoney full-quote depth. Same-session NAV premium and fetched spread are displayed. Quote fetch time is never treated as market time. ETF entries fail closed on missing/stale/mismatched NAV, unverified spread timestamps, spreads above 0.5%, premiums above 1% or discounts beyond 5%. The documented INDmoney payload lacks a quote timestamp, so a displayed spread can remain unverified and block ETF entry signals.
- NSE prior-completed-session calendar is verified only from 9 Nov through 31 Dec 2026 using NSE/CMTR/71775, including Muhurat on 8 Nov. Other exchanges/years pause signals. Raw drawdown triggers remain paused pending corporate-action adjustment verification. Asset type can be corrected in the saved rule form, followed by refresh.
- Full research scores, fundamentals/sector models, automated Gold valuation recommendations, scheduled checks, Telegram and backtesting are still incomplete. No missing data is replaced with a forced Buy/Sell label.

- Verification for this update: lint, typecheck, 262 unit tests, 18 Python tests, production build and 60 responsive signal-card fixtures passed. Hosted migration applied and constraint definitions verified. New local integration cases cover default opt-out and invalid exit rules, but local signed-in e2e/RLS remain blocked by the Supabase CLI read-only telemetry path. A repeat hosted rollback-only test required confirmation that expired, so it is not claimed as rerun. No new signal setting or ownership was enabled on the owner's records.
