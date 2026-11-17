# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 17 Nov 2026.

## Optional stock financial-report source, 17 Nov 2026

Prepared an IndianAPI starter-tier adapter for exact NSE ticker identity, annual results, balance sheets and cash flow. BSE instruments need one same-ISIN NSE counterpart. An explicit verified-stock refresh collects reports only when the separate INDIANAPI_KEY is configured server-side. It makes at most four source reads, retains partial report successes and reuses successful/partial collections under 24 hours with the original retrieval timestamp. Financial-source errors preserve the current market evidence. Raw profiles, peer/officer details, analyst recommendations and news are discarded. No paid plan is purchased, no secret is retrieved and no background collection or schema migration is added.

The folded Company reports UI shows table/period coverage, not unverified-unit financial figures. Source configuration alone does not establish access or coverage. Stock publication times, units/currency, consolidation basis, independent ISIN checks, peer valuations and sector models remain incomplete; reports never unlock valuation scoring or Buy/Hold/Sell. ETF benchmarks, price adjustments and book timestamp coverage remain separate blockers. Activation/live verification is waiting for the owner's separate API key. See investment-radar/FINANCIAL_SOURCE.md and docs/SETUP.md.

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
