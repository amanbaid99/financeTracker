# Investment Radar in Tracker

17 Nov 2026. The supplied [PRD](PRD.md) describes the full product. This release is its first
working foundation, not the completed balanced analysis or alerting system.

## Confirmed decisions

- Personal-only. Radar has a dedicated database entitlement for the existing sole owner.
  General admin status does not grant access. Other invited users do not see a Radar tab and
  cannot read or mutate its records or call its server actions.
- INDmoney's INDstocks API is the chosen data source. The owner configured its token directly
  in Vercel. No token was pasted into chat, retrieved, stored in the database or exposed to a
  client. Using this data adapter relaxes the original no-broker-dependency requirement for
  market data only. There is no execution, account, funds or portfolio integration.
- Existing login, privacy controls, themes, goals and net worth remain. Watchlist additions do
  not create holdings or change the money plan. Every addition, threshold save and removal
  requires an explicit action.
- For Radar, instruments the user searches and explicitly adds may be outside current holdings,
  as requested in the PRD. The planner's restriction on suggesting unheld named funds remains.
- Radar uses decimal market prices; existing budgets and planning amounts remain integer rupees.

## Implemented foundation

Routes: /radar, /radar/[id], /radar/setup. Five owner tabs: Goals, Net worth, Budget, Cards,
Radar. For the Radar owner, QuickAdd floats above the right corner of the bottom navigation.
Other users retain the existing four-tab navigation and docked plus control.

The owner can search the INDstocks cash instrument master by name, symbol or ISIN, confirm
asset type, add up to 30 research items, fetch daily price history and save optional price or
90-session drawdown thresholds. Instrument identity is resolved on the server from the master
again before saving. The adapter only calls GET /market/instruments and GET
/market/historical/1day on the fixed api.indstocks.com host. It rejects redirects, timeouts,
oversized responses, invalid OHLC and conflicting duplicate sessions. Provider errors never
return response bodies or credentials. Daily windows are bounded to 365 calendar days because
INDmoney silently truncates wider windows. The current session is excluded.

Price charts show actual fetched closing prices with the session date. Technical observations
include Wilder RSI14, SMA50/200, 30/90/252-session drawdowns, 60-log-return annualised sample
volatility, 252-session range and 20-session average traded value. Inputs, source, fetch time,
engine version and SHA-256 input hash are retained in immutable snapshots. The latest-snapshot
RPC is security invoker and respects owner policies. API failures retain the previously saved
snapshot with its original date; they do not mark it fresh.

Freshness cannot be verified until an exchange calendar is integrated. Corporate-action
adjustments are also unverified. These limitations are always displayed, and price thresholds
remain silent. All opportunity statuses are Insufficient Data with a null score. Missing
fundamental, sector, index and ETF inputs remain explicit blockers, never guessed scores.

## Data and security

- radar_access: an entitlement record. Authenticated users can only read their own entitlement,
  not grant or modify it. Initial ownership selects the existing sole admin without embedding
  identifiers. No future admin receives access automatically.
- radar_watchlist: owner-scoped metadata and thresholds, unique exchange/security identifier.
- radar_snapshots: owner-scoped immutable market history, input provenance and analysis. A
  composite parent foreign key prevents attaching a snapshot to another user's watchlist item.

Every table has RLS. No service-role credential is used in application code. Settings, holdings,
profile records and existing financial history are not repurposed for Radar data.

## Still needed before declaring PRD v1 complete

1. Verify live provider coverage and adjustment semantics against representative owner-selected
   instruments. The INDmoney token is present in Vercel but live authenticated flows have not
   been exercised from the development workspace.
2. Exchange holiday/special-session calendar, source freshness verification, stock fundamentals
   with actual publication dates, historical/peer valuations and sector-specific models.
3. ETF NAV/premiums/spreads/tracking and underlying index valuations. Broker price candles alone
   do not satisfy those requirements.
4. Define and validate subscore normalization and risk gates. The pasted Gold ETF weighting chart
   has no readable numerical weights; do not infer them. A price dip alone is not a buy signal.
5. Scheduled ingestion, pipeline health, cooldown/transition evaluation and a durable notification
   queue. Telegram linking, opt-in, test sends, delivery retries and audit history are not enabled.
   Saving thresholds does not enable notifications.
6. Optional anonymised AI explanations, point-in-time backtesting, baseline comparisons,
   survivorship controls and monitored paper operation. No provider outage may be filled by AI.

## Verification

Lint, TypeScript, 245 unit tests, 18 Python tests and production build passed. Headless browser
component fixtures covered 48 viewport/theme/state combinations and watchlist search, selection,
explicit save, rule forms, removal confirmation, token-error presentation and guest navigation.
Those browser fixtures use mocked actions, not a live broker account.

The hosted migration applied successfully. A rollback-only two-user SQL test verified owner
reads, foreign-user isolation, denial of self-entitlement and ownership reassignment, and denial
of cross-owner snapshot parents. No test records or emails persisted. Equivalent integration
coverage is saved in tests/integration/rls.test.ts and tests/integration/radar-rls.sql.

The full signed-in Playwright/local RLS suite and CLI type generation are blocked by the local
Supabase CLI attempting to write telemetry into a read-only home directory. New database types
were reconciled manually with the migration and checked by TypeScript. Live token and provider
coverage remain a post-deployment check; do not report them as verified from fixture tests.

## Official provider references

- https://api-docs.indstocks.com/instruments/
- https://api-docs.indstocks.com/historicalData/
- https://api-docs.indstocks.com/Users/

INDmoney documents a 24-hour token lifetime. The token must be replaced in Vercel and the app
redeployed when expired. TOTP-based renewal is documented by the provider but is not implemented
here; no TOTP seed is collected by this release.

## Next release: dated price-rule signals and ETF evidence

Rules can be explicitly enabled, with confirmed ownership and upper/lower sell thresholds.
Current price-rule output is derived from the current saved rules and dated prior-session
closing price; it is not a historical recommendation log or completed balanced model.
Existing records are not opted in. The form also permits correcting the asset type.

AMFI's complete official NAV file is fetched without sending a name, ISIN or credential to
that source. The local parser matches the exact watchlist ISIN, supports current eight-column
and legacy six-column headers, and rejects ambiguous/invalid records. Premium comparisons
require NAV and close to match the same latest verified completed session. Intraday price and
previous-day NAV are not treated as a live premium. INDmoney's fixed GET quote endpoint provides
depth; its documented response has no market timestamp. Fetch time and HTTP Date are never
used as a substitute. A missing quote timestamp blocks ETF entry even when a spread is shown.

ETF entry guardrails are a 1% maximum closing premium, 0.5% maximum fresh spread, and source
review for a discount beyond 5%. They are conservative checks, not validated score weights.
Freshness currently uses NSE/CMTR/71775 for remaining-2026 NSE sessions, with Muhurat included.
It does not extrapolate BSE or 2027. All caller dates/times are explicit inputs to pure functions.
The current session is excluded from daily-price-rule evaluation. Raw drawdown rules remain
paused until price adjustments are verified. Provider failure is recorded as missing evidence;
old NAV is not silently substituted. Failures do not produce an accumulation recommendation.

References: https://www.amfiindia.com/net-asset-value/nav-download,
https://portal.amfiindia.com/spages/NAVAll.txt,
https://api-docs.indstocks.com/MarketQuote/,
https://nsearchives.nseindia.com/content/circulars/CMTR71775.pdf.

This update adds 17 unit cases covering current/legacy AMFI formats, exact ISIN matching,
invalid/ambiguous NAV, spread parsing, special-session calendar boundaries, opt-in, ownership,
exit precedence, stale data and ETF entry blocks. The full 262-unit/18-Python checks and 60
responsive signal fixtures passed. Database constraints were verified after migration. New
local integration cases are saved; the repeated hosted synthetic test confirmation expired,
and the local full suite remains blocked by CLI telemetry. No owner's existing rules were
silently enabled.

## Automatic research correction, 17 Nov 2026

The primary UI now calls the pure automaticResearch assessment independently of optional manual rules. Classification is derived at read time from metadata and exact AMFI ISIN evidence; refresh uses the effective ETF type. Actual holdings are matched by ISIN for ownership context. Saved watchlists are not silently migrated. Manual entry/exit alerts remain explicit opt-in.

BSE and NSE previous completed sessions are verified only for 9 November through 31 December 2026. Unsupported calendar ranges fail closed. The documented full quote contract does not supply a verified quote timestamp; timestampVerified remains false, even if an undocumented timestamp is present. Fetch time is not market time.

Current automatic output is Insufficient data or an evidence-backed Wait risk. Complete Buy/Hold/Review selling models remain unimplemented pending adjusted history, underlying valuation/benchmark and tracking evidence, model validation and portfolio context. There is no automatic trading or new schema migration.

## Gold paper model implementation, 17 Nov 2026

The first Gold-only assessment and point-in-time historical comparison harness are implemented. They are not a production recommendation release. Source contracts require adjusted history, exact-ISIN NAV history, an INR Gold benchmark and a timestamped bid/ask. No current adapter populates GoldSources. Verified same-session premium risks still produce Wait; source and model gaps produce Research not ready. Missing latest-session data remains Insufficient data. Details distinguish source work from development work. See DATA_REQUIREMENTS.md for verified provider documentation, exact missing payloads, proposed guardrails and release requirements.

## Secondary historical NAV, 17 Nov 2026

Refresh now calls collectEtfEvidence: official AMFI NAV and INDstocks depth run independently; matching official NAV enables a bounded MFapi history read. Exact scheme/ISIN identity and latest NAV reconciliation are required. Failures retain independent successes. No extra key or migration is needed. The dated, labelled history chart is separate from Gold model-grade sources, whose publication/benchmark evidence is still incomplete. See DATA_REQUIREMENTS.md for verified documentation, sandbox HTTP 403 limits and remaining benchmark/time-contract requirements.

## Live reconciliation, 17 Nov 2026

The owner screenshot and read-only hosted snapshot query confirm historical NAV ingestion. Actual saved dates reconcile to 371 matches, three price-only and two NAV-only dates, one of which falls outside the shared price window. Pure alignment code now exposes these facts without mutating source records. New snapshots include typed depth diagnostics from the dedicated GET /market/quotes/mkt read. Old generic failures remain unknown; none are retrospectively labelled empty books.

The published selected-fund policy identifies MCX polled spot prices as the designated Gold valuation source. A matching archive payload, daily valuation-session mapping, historical-methodology changes and broker adjustment/timestamp semantics remain unverified. No new benchmark adapter, Buy/Hold/Sell release or database migration is claimed. See DATA_REQUIREMENTS.md and PROVIDER_QUESTIONS.md.

## Stocks and other ETFs

Shared depth collection now serves stocks via analysis.market, without requiring NAV. Generic/unsupported ETFs are identified by derived kind, receive the available ETF source path and remain blocked from stock/Gold models. Analysis records other_etf rather than misleadingly applying equity blockers. UI labels and optional entry guards use verified classification. This is source-routing coverage, not a claim that fundamental, index or other-ETF models are finished. No new hosted mutation or schema change was needed.
