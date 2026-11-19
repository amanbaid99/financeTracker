# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 19 Nov 2026.

## Paired questions and fewer prefilled costs, 19 Nov 2026

The initial known-cost list now excludes groceries, day-to-day expenses and transport; loan-linked rows remain available even when their names mention transport. Grocery amounts are entered later without a default, and personal transport/day-to-day spending stay in the Personal step/calculator. Missing essential questions appear in pairs with one Continue action; blank/zero means not applicable. Back navigation preserves entered amounts and stable row identities avoid duplicates. Other custom commitments have their own short add step. No saved budget or financial record is rewritten until explicit Save.

Verification: lint, TypeScript, 641 unit tests, 40 Python CAS tests and production build passed. Twelve responsive browser flows cover four widths and three themes, deferred initial costs, two labelled questions, empty defaults, Back preservation, no duplicate rows and explicit save. A separate empty-record flow verifies two pairs, blank/zero omission and stable totals. The signed-in local Supabase check remains blocked by the previously confirmed database-image extraction limit.

## Personal bucket and routine calculator, 19 Nov 2026

Renamed the active guilt-free bucket to Personal spending, covering personal transport, day-to-day spending and fun. Added an optional calculator in guided setup and quick edits, with monthly transport, daily spending, days per month and fun money. The transparent estimated total is checked against income left after Essentials and includes named personal costs as a minimum, not an extra charge. Applying an estimate changes only the proposal and visibly changes Save & invest; explicit Save remains required. Recognisable non-loan commute/transport expenses are grouped into Personal in the client view without a hosted write, and stay within the combined envelope when a guided plan is created. No annual contribution or goal linkage is added. Quick edits also allow moving non-loan costs between Essentials and Personal. An optional JSON marker makes the initial grouping one-time and preserves subsequent manual choices.

Verification: lint, TypeScript, full unit suite, targeted personal-calculator regressions, 40 Python tests and production build passed. Twelve responsive browser flows cover four widths and three themes, daily/day-count validation, guide estimates, explicit save, quick edits and combined-target adjustment. The local signed-in Supabase check remains blocked by the previously confirmed database image extraction limit.

## Three-bucket budget, 19 Nov 2026

Combined Savings and Investing into Save & invest throughout guided setup, recommendations, overview and quick edits. Removed annual-contribution and emergency-buffer questions. Recommendations reserve optional/default spending room and allocate the remainder to one future-money target; no internal savings/investing ratio is chosen. Existing rows are grouped without a write; optional rules.future supports an aggregate target while older separate targets remain readable. Combined target gaps count existing named saving/investment items once. Annual goal contributions are not imported or created. Existing annual provision rows are preserved until explicit edit or replacement. No SQL migration.

Verification: lint, TypeScript, unit suite, combined-target action regressions, 40 Python tests and production build passed. Twelve responsive guided flows cover four widths and three themes, one recommended target, no annual/buffer steps, explicit Save/reload and expense removal into guilt-free spending. Additional browser verification covers legacy combined totals, named-item preservation, aggregate minimums and rebuilding without annual provisions. The signed-in local Supabase check remains blocked by the previously confirmed Postgres image extraction limit.

## Guided budget and compact overview, 19 Nov 2026

Replaced the live Budget entry with Plan my budget for new users and a compact four-bucket overview for saved budgets. The guide confirms income and known costs, asks only about missing essential categories, collects annual provisions, emergency-buffer status and an optional guilt-free preference, then offers editable rupee recommendations and one explicit Save. Recommendations are deterministic and explain their starter assumptions. No external AI, goal linkage, SIP import or new table is required. Optional standalone metadata prevents guided plans from feeding existing goal/runway money calculations and prevents automatic loan insertion during read. Legacy budgets remain visible and unchanged until explicit rebuild/save. Edit monthly amounts supports quick cost/target changes and removal; future amounts stay fixed and spending receives the remainder. Reset returns to the clean entry screen.

Verification: lint, TypeScript, 636 unit tests, 40 Python CAS tests and production build passed. Twelve responsive browser fixtures cover four widths and three themes, full guided creation, known costs, annual provisions, editable recommendations, explicit save, compact collapsed overview, reload, quick cost removal and rebuild cancellation. Extra browser cases cover unaffordable costs, no intermediate writes, failed-save answer retention, load-error blocking and confirmed/cancelled reset. The signed-in e2e flow is updated; local Supabase remains blocked by the unavailable Postgres image. No hosted user budget was changed during verification.

## Stable budget targets and Personal spending, 19 Nov 2026

Budget now offers explicitly confirmed savings and investing targets, defaulted from current category amounts, with percentage or fixed-rupee basis. Existing budgets keep manual allocations until opt-in. Targets include existing SIPs and named rows; derived rows fill only target gaps. After commitments and targets, all remaining money goes to Personal spending. Named personal costs use this balance and Free to spend updates automatically. Deleting a commitment no longer redistributes money into future targets. Named allocations above targets block saving until reconciled; income shortfalls remain visible without silently cutting targets or costs. Rules are optional fields in the existing owner-scoped JSON document, normalised on server save and downstream reads. No SQL migration or hosted financial-data rewrite.

Verification: lint, TypeScript, 628 unit tests, 40 Python CAS tests and production build passed. Twelve responsive component fixtures cover four widths and three themes, including explicit target adoption, delete-to-personal allocation, earmarking personal costs, Save/reload, income-linked percentages, cancellation and Undo. Extra browser checks cover fixed rupees, below-item target conflicts and failed-save preservation. The signed-in e2e flow is updated; a full local Supabase-backed run remains unavailable in this environment.

## Suggested remainder split, 19 Nov 2026

Reviewed and retained the latest single-source Budget simplification (ed6cc5f). Unassigned money now shows an editable savings, investing and guilt-free proposal using the current category proportions, or a disclosed 40/40/20 starter mix if none exist. Integer rounding accounts for every rupee. Use this split changes only the draft, followed by explicit Save. Existing commitments and loan exclusions are preserved. No database change.

Verification: lint, TypeScript, 618 unit tests, 40 Python tests and production build passed. Twelve responsive browser fixtures cover four widths and three themes, including deletion, editable proposals, over-allocation blocking, explicit acceptance, Undo and final Save. The signed-in end-to-end test was updated; the local Supabase stack remains unavailable in this environment. No hosted financial records were changed during checks.

## One simple budget, 19 Nov 2026

Budget is now the single source of truth for monthly income and costs. `loadBudget` (lib/data.ts) reads the saved budget sheet when there is one, so Your plan, Covered till salary, Ask and the goal calculator use it; without one it falls back to income and expense records. `/goals/budget/records` redirects to Budget. The Help me build assistant, the allocation and planner components are removed. A new budget starts as an unsaved draft filled from recorded costs, loan EMIs and SIPs (`fillFromRecords` in lib/budget-assist.ts); "Fill from my records" adds anything missing later. The top card shows income, the bar, what's not assigned (To savings / To investing), over-budget help, and the goals line with "Use ₹X for Your plan" (`applySheetToPlan` sets profiles.plan_monthly to savings plus investing). Rows are compact and tap to edit. A sticky bar holds Undo and Save, with a leave warning while unsaved. No migration.

Verification: npm run check and the e2e happy path pass. The e2e also drops two assertions made stale by the owner's 18 Nov removals (holdings gain line, "What you owe on loans" region name).

## Assisted budget option implemented (superseded), 19 Nov 2026

Added the working Help me build my budget entry below income. It reviews known costs/current draft items/EMIs/SIPs, collects missing expenses and presents editable additional savings, investing and guilt-free amounts. Known source identities and names prevent common duplicate entries; uncertain EMI overlaps and previously excluded loans are not silently included. Existing future allocations can be kept or explicitly rebuilt. Recorded SIPs are offered without automatically stacking them over existing saving/investing allocations. Only the final save writes the existing budget document; cancellation and failures leave the manual draft unchanged. The manual sheet and reset remain available.

Verification: lint, TypeScript, 612 unit tests, 40 Python CAS tests and production build passed. Twelve responsive assisted flows cover four widths and three themes. Browser checks verify known costs, missing expenses, editable proposals, explicit final save, cancellation, loan exclusion persistence, income shortfalls, over-allocation and failed-save isolation. Additional scenarios cover known SIPs, repeated-use de-duplication, already-complete plan reassurance and rebuilding existing allocations. Model regressions also ensure combined SIP capacity is not counted twice across goal types. No SQL migration, external AI call or hosted record rewrite is needed.

## Confirmed reset budget, 19 Nov 2026

Added Reset budget at the bottom of the Budget sheet with an explicit confirmation panel. The action deletes only the signed-in owner's budget document and starts the client sheet with income records and current EMIs. Other financial records are untouched. Cancelling leaves saved and unsaved data intact; failed resets show an error in the panel and preserve the visible draft. The server checks explicit confirmation before authentication/deletion and filters deletion by the authenticated owner. Existing RLS and grants support the action without SQL changes. No hosted budget was reset from the workspace.

Verification: lint, TypeScript, 605 unit tests, 40 Python CAS tests and production build passed. Twelve responsive reset cases cover four widths and three themes. Browser checks confirm no request before confirmation or after cancellation, preservation of unsaved edits on cancel, fresh recorded-income/EMI defaults, reset persistence after reload, no old-budget undo and preserved draft on failure. Embedded PostgreSQL now also exercises owner deletion while preserving the other owner's budget, alongside existing RLS/cascade checks. No hosted user budget was reset during verification.

## Expense presets and fixed-cost grouping, 19 Nov 2026

Added common expense choices including Rent, Utilities, EMI, Insurance, Subscriptions and Custom. Fixed presets fill the name/category with fewer inputs; Custom exposes the manual name/type fields and defaults to fixed. Groceries and transport remain variable. Expenses now separates Fixed costs from Variable & other expenses with subtotals. The EMI preset is marked already included and disabled while tracked EMI rows exist, avoiding accidental duplicate entry. Existing categories and amounts remain unchanged.

Verification: lint, TypeScript, 602 unit tests, 40 Python CAS tests and production build passed. Twelve responsive grouped-budget cases passed across four widths and three themes. Additional browser checks cover Utilities, Custom fixed defaults, variable presets, fixed subtotals, tracked-EMI duplicate prevention and an untracked manual EMI. No SQL migration is needed. Assisted budget creation was discussed as an optional future flow, not implemented in this release.

## Grouped budget list and typed adding, 19 Nov 2026

Budget rows are grouped into Expenses, Savings and Investments with section totals, income shares and contextual Add buttons. Full names are readable, expense subtypes remain visible and amount/percentage editing stays inline. An add/edit panel handles names, types and removal; changing category moves rows between groups. Savings/investment adds preset their category and omit an unnecessary category picker. Closing a panel leaves the draft unchanged. Existing rows and JSON storage are preserved, with no migration or hosted record rewrite.

Verification: lint, TypeScript, 602 unit tests, 40 Python CAS tests and production build passed. Twelve Chromium cases cover four widths and three themes. Browser flows exercise section-specific adds, direct amount/percentage editing, correct categories, moving edited items between groups, cancellation without blank rows, save/reload, EMI removal/restore and undo. No hosted financial records were modified from the workspace.

## Budget allocation and balanced review, 19 Nov 2026

Added a top category allocation bar with rupee amounts, income percentages and unassigned money. A compact draft review recognises affordability, goal capacity and existing progress as well as relevant gaps. The review never rewrites amounts, applies an ideal ratio or claims that savings are assigned to goals. It excludes reached/loan goals and discloses unknown goal pace in comparisons. Over-budget bars are explicitly scaled to planned spending; percentages still refer to income.

Verification: lint, TypeScript, 602 unit tests, 40 Python CAS tests and production build passed. Twelve Chromium cases cover four widths and three themes with the live allocation card. Additional checks verify live goal reassurance, completed emergency context, over-budget scale labels and zero-income guidance. Calculation regressions cover unassigned money, honest overspending warnings, unknown goal pace, no double-counting of goal SIPs and positive recognition without an imposed ratio. No schema or hosted financial-record changes are needed.

## Manual budget sheet, 19 Nov 2026

Replaced the ratio wizard and suggestion UI with a manual sheet. Each row has name, category, amount and percentage, with instant two-way conversion. Last-edited rupee values remain fixed when salary changes; percentage values resize. Totals allow partial allocation and clearly flag overspending. Active EMIs default to fixed-expense rows once; manual edits and removals persist. Older saved plans flatten into reviewable rows, with old debt allocations covering scheduled EMIs before any extra amount is added. No automatic save or hosted data rewrite occurs.

The existing JSON table stores version 2; no schema migration is required. Server validation protects row size, amounts, categories, unique loan rows and loan ownership. Separate goal-plan income/cost tools remain at `/goals/budget/records`. Verification: lint, TypeScript, 596 unit tests, 40 Python CAS tests and production build passed. Twelve Chromium cases cover four widths and three themes, including two-way amount/percentage edits, income changes, categories and saving. Additional cases verify removed EMI persistence and restoration, undo, over-budget plans and failed saves. Compatibility tests cover old nested budgets and prevention of duplicate debt. No hosted financial records were written from the workspace.

## Budget UX and optional EMIs, 19 Nov 2026

Prepared a three-step Salary/Split/Review editor with compact main-bucket rows and a separate panel for optional smaller allocations. EMIs are now explicitly selected per loan. No EMI is included by default; only selected loans affect ratio suggestions, debt detail suggestions, warnings and the Budget tab's recorded commitment summary. New loans are not silently opted in. Existing saved allocations remain intact and editable. The server checks ownership of selected loan IDs. The existing JSON storage supports this without SQL changes.

Verification: lint, TypeScript, 588 unit tests and production build passed. Twelve Chromium cases cover the three-step flow across four widths and three themes. Additional browser scenarios verify unchecked EMI defaults, cancellation of the chooser, a selected subset, saved selections after reload, opting out, cancellation of edits and nested percentage validation. Older plans default to no approved EMIs and keep their saved amounts. No hosted financial records are modified by this release.

## Ratio budget release, 19 Nov 2026

Supabase access recovered. Applied the budget table migration as recorded version `20261119061828` and aligned the repository filename with that hosted version. Existing balances, income, SIPs and loan records were untouched. Hosted metadata confirms owner-only RLS policies, authenticated CRUD grants and no anonymous access. No budget-table security advisories were reported. The previously tested feature is ready for production deployment.

## Ratio budget planner prepared, 18 Nov 2026

Implemented Plan my budget in the Budget tab: salary, editable main percentage buckets, nested parent-share ratios, goal links, custom labels, suggested main/detail splits and explicit Save budget. Recorded income and commitments remain available below. Warnings disclose underfunded costs, EMIs and SIPs. The planner does not execute payments or change recorded income, SIPs, expenses or goals.

New migration `20261119061828_budget_ratio_plan.sql` creates one owner-scoped document per user with RLS and account-deletion cascade. No hosted DDL or user-data writes have been applied. Two Supabase metadata calls never returned and were aborted; the CLI fallback reports AccessTokenRequiredError. Release is pending this migration, so the feature has not been pushed to the production branch.

Verification: lint, TypeScript, 585 unit tests including actual embedded PostgreSQL owner CRUD/anonymous/cascade checks, 40 Python CAS tests and production build passed. Twelve Chromium cases cover four widths and three themes; manual scenarios cover custom main buckets, main and child totals, salary-to-child amounts, save/reload, cancel and failed saves. Full local signed-in/RLS API tests remain blocked by the previously confirmed Supabase Docker image-download restriction. The new integration regression is prepared. No external AI calls or production secret retrieval occurred.

## Home milestone priority, 18 Nov 2026

Home now chooses the unfinished milestone with the smallest rupee amount left, across all cards. Deadline is only a tie-breaker after equal remaining amounts and progress. Completed, expired and invalid targets stay excluded; card-loan EMIs still do not count. This replaces deadline-first selection at the owner's request. Verified: lint, TypeScript, 19 Home/card unit tests and production build passed. No schema or stored data changes.

## Home and simpler portfolio, 18 Nov 2026

Home (`/today`) replaces Radar and is the default after sign-in and in the PWA manifest. It shows recorded net worth, three focus goals, the next unfinished card milestone and updates due. Goals use the same priority order as the detail page; reached goals are excluded. Milestones exclude completed/expired targets and loan EMI spending. Empty states link to the relevant section. The sticky plus remains above five navigation tabs.

Portfolio now offers Upload CAS and Update amounts. Invested/gain-loss summaries, manual units/ISIN fields, price-refresh controls, performance charts and post-import performance commentary are removed. CAS review-before-save and stored metadata remain. Radar routes redirect to Portfolio and archived server actions deny access. No tables or financial records were deleted. Earlier Radar work below is historical and is no longer an active goal.

Validation: lint, TypeScript, 572 unit tests, 40 Python CAS-reader tests and production build passed. Chromium fixtures passed 24 Home checks across four widths and three themes with populated/empty states; four responsive Portfolio edit/update form checks, six production-build legacy redirects and the PWA start URL passed. Full signed-in end-to-end checks remain unrun because local Supabase image downloads are blocked by Forbidden responses. No hosted financial data was changed.

## Experimental Radar reliability and migration replay, 18 Nov 2026

Experimental insights, suggested levels and dip orders now use the caller's current IST date and verified exchange calendar. Outdated, future, malformed, missing and nonpositive prices cannot produce an actionable lean or levels, receive no dip budget and cannot trigger reached prompts or take-profit suggestions. Saved close/date remains visible. Weekends, holidays and the verified special session use the completed-session calendar rather than a 24-hour age rule. A client day subscription rechecks on focus/foreground and while left open; it does not change the pure finance functions. Refresh all no longer declares every price current merely because requests succeeded or cooldown skipped a read. The owner's experimental approach is preserved.

The CAS reader retains explicit zero-balance fund entries so review can clear existing units/value by exact ISIN, but ignores closed funds not already tracked. An active folio/account position supersedes a closed entry for the same ISIN. Unknown raw balances are not treated as explicit redemptions. An action regression covers review, owner-scoped save and a subsequent NAV check, preventing stale units from restoring a redeemed value. Unknown/invalid units remain null. The existing dated holding-review migration skips an absent table, and foundation creates the matching column/constraint/comment. Versions and hosted migration history remain unchanged; no hosted migration or user-record mutation is needed. A pinned development-only PGlite dependency runs actual PostgreSQL migration/constraint/RLS regression cases for sorted fresh replay and existing-table/idempotent application without touching hosted data. Verification passed: lint, TypeScript, 567 unit tests, 40 Python tests and production build. The PostgreSQL cases exercise sorted Radar replay, existing-table/idempotent review application, size/object constraints and actual cross-owner updates under authenticated roles. Chromium fixtures passed 24 responsive detail/watchlist cases across four widths and three themes, plus focus and automatic IST-midnight rechecks, with no page errors. The current full signed-in e2e attempt was blocked before app testing by a PostgreSQL Docker image download returning Forbidden; its retrying child was stopped. Vercel deployment of 50d293d succeeded. No hosted migration or holding update was applied by the workspace.

## Invested, gains and Update prices, 18 Nov 2026

Net worth shows Invested and Gain/Loss (₹ and %) over holdings with a known invested amount, and how many are left out. Amount invested sits next to value in the holding sheet. New `holdings.units` (migration `20261128000000_holding_units.sql`, snapshot now carries `isin` and `units`) is saved by CAS imports and editable (with ISIN) for funds, stocks and gold. Update prices fetches AMFI's NAV file once, values units × NAV by ISIN (funds and ETFs, including gold ETFs) and shows old vs new for review; only ticked rows are saved. Stocks aren't priced yet. Code: `lib/prices.ts`, `lib/price-actions.ts`, `components/update-prices.tsx`; tests: `tests/unit/prices.test.ts`.

## Today's dip plan and Refresh all, 18 Nov 2026

The Radar page now opens with "Today's dip plan": one Refresh all button (refreshes each item in turn; "just refreshed" counts as up to date), a "Money for dips" budget (default ₹5,000, remembered on the device) split evenly across the watchlist, and for each item two buy orders (price, whole quantity, amount): the saved buy price or nearest suggested dip, then a deeper one (falling back to the one-year low). Held items also get a take-profit price. Reached steps are highlighted. The app never places orders. The watchlist is capped at 10 items. Code: `lib/radar/dip-plan.ts`, `components/radar-dip-plan.tsx`; tests: `tests/unit/radar-dip-plan.test.ts`.

## Experimental Radar insight and level suggestions, 18 Nov 2026

The owner chose the faster route to Buy/Hold/Sell insight. Radar items now show an "Experimental insight" lean with every reason listed (trend, 50/200-day averages, RSI, one-year range, NAV premium for funds, and the paper stock score once complete), on the list and at the top of each item. The automatic research result stays gated beneath it. The price-alert form explains how to choose levels and offers suggestions from the item's own year of prices (200-day average, typical three-month swing, one-year high and low); tapping fills the field, Save stores it. NIFTYIETF's type was corrected to index ETF in the hosted watchlist at the owner's request; its next refresh uses the ETF checks. Unit tests: `tests/unit/radar-insight.test.ts`.

## Local Radar checks run, 18 Nov 2026

The local stack started (Docker restarted, `SUPABASE_TELEMETRY_DISABLED=1`). The three Radar migrations apply locally; `20261118063622_radar_holding_review.sql` sorts before the table it alters, so a fresh local `migration up` needs `--include-all` (the file name matches hosted history, so it was not renamed). The Radar RLS block ran after the account-deletion test, which removes user A; it now runs before "row level security". Verified: lint, TypeScript, 534 unit tests, 37 Python tests, 68 RLS tests (including Radar) and the Playwright happy path.

## INDstocks support-confirmed partial history policy, 18 Nov 2026

The owner supplied a written support confirmation: OHLC is split/bonus-adjusted with two-decimal rounding, volume is raw, consolidations depend on split classification, and dividends/rights/mergers/demergers are not adjusted. The public API has no action endpoint or per-candle adjustment flag. This resolves the provider-policy question for split/bonus handling, not an independent event audit or full model readiness. The raw correspondence and personal identifiers are not committed. See investment-radar/INDSTOCKS_HISTORY_POLICY.md.

New explicit refreshes record policy and collection-time provenance in hashed snapshot inputs; old snapshots are unchanged. The history view/source checks now distinguish provider-confirmed partial coverage from complete relevant event/EPS coverage. Prices are never adjusted a second time. Turnover estimates from adjusted price times raw volume are withheld, including old estimates in live research, and the Gold paper model requires an explicit compatible turnover basis. Missing dividends mean price returns, not total returns; they do not alone prohibit price-only charts or correctly based P/E. No new schema, provider access, account read, private-data AI call or live recommendation is introduced. Verification passed: lint, TypeScript, 534 unit tests, 37 Python tests and production build. Chromium fixtures passed 24 new policy views plus 168 regression views across four widths and three themes, with no page errors; legacy snapshots retain the unverified label. The refresh-action test confirms a new history read, provenance capture, unchanged legacy snapshot and null turnover. Gold paper version 2 requires compatible turnover explicitly. Signed-in e2e remains unrun due to the previously verified local image-download Forbidden blocker. Vercel deployment of 76882b0 succeeded. Refreshing a selected instrument is required to save the new policy; no hosted record was rewritten from the workspace.

## Optional saved holding review, 18 Nov 2026

Added an optional holding-review form for confirmed stock holdings with an exact ISIN. The owner enters allocation target/band, thesis status and estimated exit costs, explicitly confirms ownership/context and presses Save. No defaults, recommendation, personal free text, provider request or AI payload is added. The review can be removed. The server derives ISIN and review time, validates input strictly and scopes all writes by authenticated owner plus Radar entitlement. Recorded allocation is derived from current matched Tracker values, never accepted from the browser. Saved context remains subject to the paper model's freshness checks and never bypasses source/model gates.

A nullable holding_review JSON column is applied under existing watchlist RLS, with object/size constraints and no changes to existing reviews or records. Save/remove action tests check auth, owner scope, server metadata, missing holdings, invalid values and failures. Local-only RLS regression now covers cross-owner review updates. Hosted schema inspection confirmed the JSON column, its constraint and unchanged enabled owner RLS. Generated hosted types confirmed the nullable/optional JSON field used in the checked-in types; unrelated generated differences were excluded. The migration file version matches hosted migration history (20261118063622). Security advisors reported no Radar-specific finding; existing unrelated admin-function and auth advisories are unchanged. Verification passed: lint, TypeScript, 525 unit tests, 37 Python tests and production build. Chromium fixtures passed 12 responsive save flows across four widths/three themes, plus saved-review date, removal, failure and no-longer-held removal checks. No page errors occurred. The local-only RLS regression is added but unrun because the local image-download Forbidden blocker remains; schema/policy inspection and action mocks do not substitute for signed-in e2e. Old reviews remain removable after a position disappears, while new saves require a current confirmed stock holding. Vercel deployment of 62f33d7 succeeded. Source verification and real historical validation still block live Buy/Hold/Sell. No hosted user review is written by the workspace.

## Paper holding and exit assessment, 18 Nov 2026

Added stock-position-paper-1 and integrated it into automatic research for owned stocks. It requires the entry model's complete verified inputs plus same-ISIN positive ownership, a confirmed allocation target/band, reviewed thesis and exit-cost context. Missing data never defaults to Hold. Complete inputs yield paper Hold candidate, Review holding or Review selling. A failed entry screen alone never becomes a sell instruction; over-allocation is a rebalancing review, not a full exit. Context freshness is a declared experimental 90-day limit.

Live research remains Research not ready with a null score, including when a synthetic paper exit case passes. The app does not yet collect/save reviewed target/thesis/cost context, and no current portfolio values are promoted to those facts. This work has no hosted mutation, migration or provider dependency. Verification passed: lint, TypeScript, 509 unit tests, 37 Python tests, production build and 168 responsive Chromium fixture cases with no page errors. Signed-in e2e remains blocked by the previously verified Docker image-download Forbidden response. Vercel deployment of ffa4bfa succeeded. Full recommendation release remains blocked on source verification and real historical entry/exit validation.

## Holding context independent of adjusted prices, 18 Nov 2026

Radar now carries read-only exact-ISIN holding context alongside the existing ownership flag. It combines matching recorded positions and shows recorded value plus share of all tracked investments in a folded Your holding panel. Holdings without ISIN remain in the denominator; no names or fuzzy matches establish ownership. These saved values are not a live broker balance, target allocation, confirmed thesis or a Hold/Sell release. Manual ownership without a matched value is explicitly distinct. Invalid/negative/fractional/nonfinite values and unsafe sums withhold affected amounts or percentages instead of producing misleading context. No schema, provider call, AI payload or hosted-record mutation is introduced. Verification passed: lint, TypeScript, 491 unit tests, 37 Python tests, production build and 24 responsive Chromium views across four widths and three themes. Signed-in e2e remains blocked by the previously verified local image-download Forbidden response; fixture checks are not a live signed-in test. Vercel deployment of 5310e77 succeeded. Buy/Hold/Sell remains unreleased while required source verification and model validation are incomplete.

## Source-contract review and test-runner recovery, 18 Nov 2026

Rechecked current primary provider documentation. INDstocks' changelog mentions a new adjusted-price field, but its history contract still documents only ts/o/h/l/c/v without the adjusted field name or split/bonus/distribution rules. This is a clarification lead, not verified adjustment coverage. IndianAPI's public historical-stat examples still do not settle the reported EPS definition or provider total-assets discrepancy. The live research gate remains unchanged. No provider was contacted and no paid service or credential was acquired.

Recovered the Supabase CLI telemetry failure using its documented SUPABASE_TELEMETRY_DISABLED=1 override. The local stack is absent; starting it reaches an image-download Forbidden response, so signed-in e2e remains unrun. Stopped that task's retrying start process. scripts/e2e.sh now opts out of telemetry and checks actual status variables because this CLI can return exit 0 with a JSON error. Missing/incompatible variables fail with a clear message before building or running Playwright. Bash syntax and controlled success/error-response shell checks passed. No app, schema, production key or hosted data changed.

## Stock valuation provenance and replay, 18 Nov 2026

The stock-paper-3 contract requires the price and underlying annual EPS behind every historical and peer valuation. It derives P/E itself, rejects earnings published after that valuation session, stale or impossible annual periods, missing adjustment verification and nonfinite ratios. Opaque provider multiples cannot unlock scoring. No adapter is promoted to verified and the live recommendation gate stays closed.

Added an offline forward-outcome audit using dated source snapshots and price prefixes only. It labels a caller-declared holdout and measures eligible future adjusted-price outcomes from the next session close, with explicit two-sided costs. Missing evidence or future prices produce no fabricated outcome. This is not a portfolio backtester, performance claim or proof of survivorship-free coverage. Synthetic regression cases cover leakage, costs, timing, missing data and invalid inputs. The uploaded filing still leaves provider total assets and EPS definitions unresolved; no guessed reconciliation or model eligibility is introduced. Verification passed: lint, TypeScript, 479 unit tests, 37 Python tests and production build. The local signed-in e2e attempt failed before app testing because the Supabase CLI telemetry path is read-only. No schema or hosted-record mutation is needed. Vercel deployment of 2efb5e0 succeeded. The recommendation release remains gated on independently verified financial definitions, price adjustments and real point-in-time evaluation data.

## Reviewed filing comparison, 18 Nov 2026

The real public source CI run 44230631531 passed: the HTML parser extracted 14 facts with no issues and passed the six initially audited sample assertions. The reviewed copy now supplies a small public reference catalog for the selected ISIN, with all 14 facts checked by CI before this stage is considered verified. This is limited explicit reference coverage, not automatic filing discovery for every stock.

A generic source-comparison helper matches exact ISIN, fiscal date and statement rows. The Company reports detail now has a folded Annual filing comparison. Agreements remain conditional on an explicitly assumed crore scale; total assets need review and unspecified EPS is never equated with diluted EPS. Missing/duplicate dates or rows, conflicting dimensions and inconsistent normalized amounts cannot produce a match. All provider/model verification flags remain unchanged. The comparison uses existing collected reports and needs no new refresh, SQL migration or hosted record change. Local verification passed: lint, TypeScript, 458 unit tests, 37 Python tests and the production build. Chromium fixtures passed 180 responsive cases, including 12 filing-comparison views. Full signed-in local e2e remains blocked by the Supabase CLI telemetry write to a read-only home. Deployed successfully on Vercel from 8f14907. Public-source CI run 44232751696 passed the expanded assertions against all 14 catalog facts. The stock recommendation release remains unfinished.

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
