# Architecture

How the code fits together. Rules and conventions are in [AGENTS.md](../AGENTS.md); product
decisions are in [DECISIONS.md](DECISIONS.md).

## Current overview

The signed-in entry is `/today` (Home). It reads cached owner-scoped goals, cards, loans and recorded balances. `lib/home.ts` selects three unfinished goals and the next unfinished milestone without side effects. Portfolio accepts CAS imports and manual current-balance updates. Radar UI and price-refresh actions are removed; stored data and pure research libraries remain archived. No active route depends on broker tokens.

## Manual budget sheet

`lib/budget-sheet.ts` validates version-2 row documents and derives amount/percentage values from the last-edited basis. `BudgetSheet` is always directly editable, with totals and explicit Save budget. `saveBudgetSheet` validates ownership of loan-linked rows and upserts the signed-in user's existing `budget_ratio_plans` JSON document. Active EMIs are merged once as fixed expenses on read; deleted row IDs are excluded until restored. Saved version-1 allocations flatten into rows for review, avoiding duplicate debt. Reading never writes or rewrites existing records. The former ratio calculation helpers remain only for compatibility and tests. Recorded income/cost tools are at `/goals/budget/records`.

## Stack

- **Next.js 16 App Router** with React 19.3, TypeScript, Tailwind CSS v4. Server components load
  data; mutations are server actions validated with zod. Read `node_modules/next/dist/docs/`
  before using a Next.js API you're unsure about: this version differs from older ones.
- **Supabase** Postgres + Auth (email code and Google), RLS on every table. Local stack via the
  Supabase CLI.
- **Python functions on Vercel** (`api/`) for reading CAS statements (`casparser`) and text from
  PDFs (`pypdfium2`).
- **OpenRouter** for optional AI, through a model router (`lib/ai/router.ts`).
- Tests: Vitest (unit, RLS integration), pytest, Playwright.

## Request flow

1. `proxy.ts` (Next 16's middleware) refreshes the Supabase session cookie on every request.
2. `app/(app)/layout.tsx` is the signed-in shell: slim header (logo, settings), page content in a
   `ViewTransition`, the disclaimer footer, and the bottom tabs
   (`AppTabs`: Goals, Net worth, + (`QuickAdd`), Budget, Cards; Ask and Settings are in the header).
3. Pages call loaders in `lib/data.ts` (`loadGoals`, `loadCards`, `loadOnboarding`). They're
   wrapped in React `cache`, so several components on one page share one database round trip.
   `requireUser()` redirects to `/login` when signed out and to `/consent` when the privacy policy
   version changed.
4. Each tab has a `loading.tsx` (`components/page-skeleton.tsx`) so navigation is instant, and
   `components/nav-pending.tsx` shows a strip while the next tab loads.
5. The app layout also holds the shared pieces: `ToastProvider` (`components/ui/toast.tsx`,
   `useToast()`), `TourProvider` (`components/tour.tsx`, `useTour()`), `NavHistory` for
   `BackLink` (`components/back-link.tsx`), and `error.tsx` boundaries. The root layout registers
   `public/sw.js` (offline page only). Form drafts use `useDraft` (`components/use-draft.tsx`).
6. Client components call server actions (`lib/actions.ts`, `lib/cards-actions.ts`,
   `lib/statement/actions.ts`, `lib/ask/actions.ts`, ...) and then `router.refresh()`.

## Routes

| Route                       | What it is                                                             |
| --------------------------- | ---------------------------------------------------------------------- |
| `/login`, `/auth/callback`  | Sign in (invite list checked by a database trigger), privacy consent   |
| `/consent`                  | Re-accept the privacy policy after `PRIVACY_VERSION` changes           |
| `/goals` | Start page: goal progress, next step and planning; updates and imports via + |
| `/goals/plan` | Your plan: where the money goes and why, and this month's SIP steps, with Edit order |
| `/goals/salary` | Covered till salary: salary dates, money you can reach, EMIs, living costs and bills till salary |
| `/goals/order` | Your order for the plan (`goals.plan_rank`), from Edit order on Your plan |
| `/goals/budget` | Budget tab (own tab, though under /goals): Manual amount/percentage budget sheet, active EMIs as fixed expenses and a link to recorded income/cost tools |
| `/goals/new`, `/goals/[id]` | New goal; one goal with its plan, investments and suggestions          |
| `/assets`                   | Net worth tab: net worth today, what you owe (loans), what you own (total, allocation, holdings) |
| `/assets/net-worth`         | Net worth, what you own and what you owe over time, by asset class and by loan |
| `/cards` | Cards: statements for milestones only, milestones, which card to use |
| `/ask`                      | Private Q&A about your own numbers (AI, opt-in)                        |
| `/help`                     | Searchable answers from `lib/help.ts`                                  |
| `/whats-new`                | Every past release note from `RELEASES` in `lib/guides.ts`             |
| `/import`                   | CAS statement import with a review step                                |
| `/settings`                 | Theme and accent, guides, AI opt-in, invites (admins), delete account  |
| `/privacy`                  | Public privacy policy                                                  |

## Data model

All tables have `user_id` and RLS. Types are generated into `lib/supabase/database.types.ts`.

| Table                                           | Holds                                                                                   | In code        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------------- |
| `goals`                                         | Goal name, type, target (today's money), date, inflation; loan fields for `loan_payoff` | `GoalInput`    |
| `holdings`                                      | Investments: kind, category, name, value, monthly SIP, invested, ISIN                   | `Investment`   |
| `goal_allocations`                              | Which holding pays for which goal, and what percent of it                               | `Link`         |
| `goal_bills`                                    | Payments a bills fund saves for: amount, next due, every N months (0 = one time)        | `Bill`         |
| `loans`, `loan_payments` | Loans and each EMI marked paid (with the figures before, for Undo) | `lib/loans.ts` |
| `credit_cards`, `card_milestones`, `card_bills` | Cards, spend milestones, monthly bills                                                  | `lib/cards.ts` |
| `profiles`                                      | Theme, accent, money plan amounts, AI opt-in                                            |                |
| `settings`                                      | Guides seen, "What's new" seen                                                          |                |
| `consents`                                      | Every privacy, disclaimer and AI consent, with version                                  |                |
| `ai_requests`                                   | Time, feature, model and tier of each AI call (never content), for limits               |                |
| `allowed_emails`, `app_admins`                  | The invite list and who can manage it                                                   |                |

Some tables from the first version (`income_streams`, `income_entries`, `expenses`,
`liabilities`, `insurance_policies`, `bill_status`, `planned_expenses`, `month_bills`) are no longer
read by the app. Leave them alone unless the owner asks to drop them.

## Finance logic (pure functions)

Everything in this section is pure TypeScript with no I/O. "Today" is always passed in. Each has
unit tests in `tests/unit/`.

- **`lib/tracker.ts`**: `trackGoal(goal, investments, links, today)` turns a goal plus the share of
  each linked holding into a `TrackedGoal`: current value, blended return, inflated target,
  projection, extra SIP needed, status. `freePercent` says how much of a holding isn't on any goal
  yet. Loans use `lib/loan.ts`; bills funds use `lib/bills-fund.ts`.
- **`lib/bills-fund.ts`**: a fund for known future payments. It simulates the balance month by
  month over the next 12 months. `monthlyToCover` finds the smallest monthly amount that never
  runs short (binary search), never below the steady average for repeating bills. It also gives
  `needsToday`, `topUpNow` and the first date it would run short.
- **`lib/goal-summary.ts`**: the one-line headline and colour for each goal, and goal sort order.
- **`lib/allocate.ts`**: `planMoney` splits "savings now" and "monthly to invest" across goals,
  in this order: bills funds; emergency savings up to 3 months of essentials within a year
  (`essentialsMonthly` = budget costs + EMIs, else half the fund's target; skipped when a dated
  emergency fund has its own plan); a fifth of the monthly money kept for dated goals 5+ years away
  (only what they need); nearer dated goals by time group, must-haves before nice-to-haves, then
  soonest (just enough to be on time); goals 5+ years away (the fifth plus anything left); then
  goals with no date by how much each still needs. Suggestions come out in that order. `categoryForHorizon` picks the kind of fund for each goal by
  time left: under 1 year liquid, 1 to 3 years short debt, 3 to 5 years balanced advantage, 5+
  years equity index; emergency and bills funds always liquid.
- **`lib/sip-plan.ts`**: turns the plan into SIPs in the user's own funds. `splitForGoal` spreads a
  goal's amount across up to 3 suitable holdings linked to it: one per kind, weighted 3:2:1 by how
  well each kind fits (`STAND_INS`), funds only this goal uses before shared ones, savings
  accounts only if nothing else fits. Funds take at least ₹500 a month (₹1,000 lump), ETFs at
  least ₹100 (detected by "ETF" or "BeES" in the name; what they track comes from the name). Gold
  gets at most 20% and is never used for liquid needs. With nothing suitable it falls back to an
  unused holding, then to "New <category>".
- **`planSteps`** (also in `lib/sip-plan.ts`) turns the plan into the "This month" checklist:
  one step per holding with its monthly raise and one-time amount. `applyPlanStep` and
  `undoPlanStep` in `lib/actions.ts` record a ticked step and put it back.
- **`lib/budget.ts`**: free to invest = income − costs − EMIs − SIPs, and the savings rate.
- **Net worth**: `net_worth_history` (one row per day) is filled by database triggers on
  `holdings` and `loans`. The retained archive loader `loadNetWorth` reads it and adds a point for today; active Home and Portfolio use `loadCurrentNetWorth` without reading history;
  `components/net-worth-card.tsx` draws it as a small SVG chart (no chart library).
- **`lib/ask/amount.ts`**: finds "where should ₹X go?" questions, splits the amount with
  `planMoney`/`planSteps` (codes only), and checks the reply's figures against the facts.
- **`lib/goal-status.ts`**: a goal's status label, its time group (`horizonGroup`: next month,
  this quarter, 6 months, a year, 1 to 5 years, 5+ years, no fixed date; bills funds by their next
  payment; also used by the plan's order), the line under its name, the hint on its card, and
  `gapOptions` (extra a month) for a goal the plan can't cover.
- **Must have / Nice to have** is `goals.priority` (3 / 4), read as `niceToHave`. Emergency funds,
  loans and bills funds are always must-haves.
- **`lib/fund-goal.ts`**: for a goal with nothing linked, which holdings could be linked and what
  new kind of fund would suit it.
- **`lib/portfolio.ts`**: totals by asset class, holdings with gains where `invested` is known.
- **`lib/cards.ts`**: the current milestone period, spend in it (logged bills in the period, excluding card-loan EMIs), and pace needed. Legacy unbilled entries are not counted.
  **`lib/card-advisor.ts`** says which card to use next from milestones and deadlines.
- Shared helpers: `lib/dates.ts` (IST calendar dates, EMI dates), `lib/format.ts` (₹, dates),
  `lib/categories.ts` and `lib/instruments.ts` (category labels, planning returns, kinds).

## AI

- `lib/ai/openrouter.ts` reads settings from the environment. AI is off without
  `OPENROUTER_API_KEY`, and each user must opt in (consent version `AI_CONSENT_VERSION`).
- `lib/ai/router.ts` (`AiRouter`, `sharedRouter()`): reads OpenRouter's live model list (cached 6
  hours) and key status, ranks free models, uses two different makers when answers must agree,
  rests models that fail, and falls back to cheap paid models within `AI_PAID_DAILY_USD` and
  `AI_PAID_PER_USER_DAILY` (`lib/ai/budget.ts`). Paid requests always ask for no data retention.
- Features that use it:
  - **Ask** (`lib/ask/`): `buildAskContext` sends rounded numbers with names replaced by codes;
    `restoreNames` puts the user's names back into the reply.
  - **Card features** (`lib/card-extract.ts`, `components/card-features.tsx`): text from a pasted
    description or a PDF (`/api/pdf_text`), masked, read twice by different models; a fact is
    "confirmed" only if both agree and the amount or words appear in the source. The user checks
    each fact before saving.
  - **Statement categories** (`lib/statement/ai-categories.ts`): only for scheme names the rules
    in `lib/statement/categories.ts` can't place. Only public scheme names are sent.
- Tests point `OPENROUTER_BASE_URL` at `tests/e2e/fake-openrouter.mjs`.

## Portfolio reviews

`lib/portfolio-review/checks.ts` computes findings and material-change thresholds. `service.ts` queues a revision in `portfolio_reviews`, then uses Next `after` for an uncached post-save read and optional AI prioritisation. `actions.ts` handles the separate opt-in and manual retries. Holding saves, deletions, value updates and confirmed CAS imports schedule checks. The Portfolio card polls while a review runs. AI only returns an ordering of known finding codes, checked before storage; failures retain deterministic checks. Apply migration `20261114000000_portfolio_reviews.sql` before enabling the feature. Existing holdings saves remain available if review storage is absent.

## Statement import

1. `components/import-flow.tsx` posts the CAS PDF and password to `/api/cas_parse`
   (`api/cas_parse.py` on Vercel; `scripts/cas_dev_server.py` locally, via the
   `CAS_PARSER_DEV_URL` rewrite in `next.config.ts`). The function checks the Supabase session,
   parses in memory and never stores the file or password.
2. `lib/statement/actions.ts` `prepareImport` builds review rows (`lib/statement/review.ts`):
   match to existing holdings by ISIN or name, category, SIP, questions for the user.
3. The user reviews and confirms; `applyImport` writes the changes.

## UI building blocks

- `components/sheet.tsx`: the bottom sheet used for every form.
- `components/investment-sheet.tsx`: add or edit an investment and its goal links. Props
  `prefill`, `pickExisting` and `topUp` open it pre-filled from a suggestion.
- `components/goal-details.tsx`, `goal-actions.tsx`, `goal-list.tsx`: goal page and list.
- `components/money-plan.tsx`: the money plan card ("SIPs to start" and "By goal").
- `components/card-list.tsx`, `card-advisor.tsx`, `card-features.tsx`: the Cards tab.
- `components/guides.tsx`: first-visit guides and "What's new" (data in `lib/guides.ts`).
- `components/ui/`: button, card, badge, input, progress (shadcn style).
- Theme: CSS tokens in `app/globals.css`; 10 accents, light and dark (`lib/theme.ts`). Accent
  changes need the `profiles_accent_check` constraint updated by a migration.

## Personal Investment Radar

/radar, /radar/[id] and /radar/setup use lib/radar/data.ts and authenticated server actions. Dedicated radar_access entitlement plus RLS restrict the feature to the owner. lib/radar/indmoney.ts is a fixed-host read-only market adapter; analysis.ts computes deterministic provisional indicators. Watchlists do not feed holdings or net worth. Immutable snapshots retain inputs, source and engine hash. Full balanced scoring, schedules, Telegram and backtesting are pending verification and implementation; no buying score is fabricated from prices alone.


## Gold paper research, 17 Nov 2026

lib/radar/gold-model.ts validates dated NAV/INR Gold benchmark evidence and evaluates explicit paper guardrails. It never enables production recommendations. Optional GoldSources belong to immutable ETF evidence, with no new database table. No current adapter populates them. Research derives readiness from the saved snapshot; paper calculations use the existing candle payload. lib/radar/paper-replay.ts compares model, monthly, immediate and simple-dip policies using next-open execution and actual signal availability. See investment-radar/DATA_REQUIREMENTS.md for the unconnected sources and uncompleted validation work.


## Secondary NAV history

lib/radar/etf-evidence.ts fetches official NAV and INDstocks depth concurrently. Once official same-session NAV is available, lib/radar/nav-history.ts requests the matching public MFapi scheme code, validates identity and reconciles the latest NAV. Separate EtfEvidence.navHistory data records provenance, dates and explicit unverified publication/adjustment status. A failure preserves the other evidence and never silently fills gaps. components/radar-nav-history.tsx draws an optional, labelled NAV chart. GoldSources stays unpopulated until model-grade publication and benchmark evidence is available. No schema change or automatic user-record rewrite is required.


## History alignment and depth diagnostics

lib/radar/history-alignment.ts compares ordered source dates and retains separate price-only, NAV-only and outside-window differences. It is derived from snapshots without rewriting hosted user data or inferring missing values. The expanded NAV history shows the audit. INDstocks depth now uses GET /market/quotes/mkt. Typed errors map to safe source diagnostics stored in optional EtfEvidence.depthStatus; legacy snapshots remain valid. Actual market timestamps are still not verified by the REST contract.


## Multi-asset source routing

collectMarketEvidence is shared by stocks and ETFs; stock snapshots retain analysis.market without requesting NAV. needsEtfEvidence uses derived instrument kind, so unsupported ETFs still receive available ETF data instead of being treated as stock fundamentals. Their analysis asset is other_etf and classification stays blocked. classificationLabel keeps legacy storage tags out of UI model labels. Manual entry guards also require a verified classification; a legacy equity tag cannot bypass ETF checks. No schema migration or live recommendation model is added by these routing changes.


## Optional stock financial-source adapter

lib/radar/stock-financials.ts supplies the fixed-host IndianFinancialProvider, strict ticker mapping, report parser and 24-hour reuse guard. The server-only data loader reads INDIANAPI_KEY without exporting it to clients. A verified stock refresh gathers depth and financials concurrently after price ingestion; errors remain independent. BSE mapping uses one same-ISIN NSE counterpart from the instrument master. Only the public canonical symbol is sent. Large raw profiles, analyst views, recommendations and news are discarded. Normalised annual/balance/cash-flow tables and source provenance live in optional analysis.financials; known errors live in analysis.financialsError. Both enter the snapshot input hash. Original retrieval times are retained on reuse.

components/radar-stock-financials.tsx shows folded report coverage, not unverified-unit monetary figures. Fiscal period ends are never treated as filing/publication timestamps. All model-readiness, units, currency, consolidation and independent ISIN verification flags stay false. The adapter does not unlock stock scoring, change ETF models, read broker accounts or place orders.
