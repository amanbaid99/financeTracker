# Architecture

How the code fits together. Rules and conventions are in [AGENTS.md](../AGENTS.md); product
decisions are in [DECISIONS.md](DECISIONS.md).

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
   `ViewTransition`, the disclaimer footer, the + button (`QuickAdd`) and the bottom tabs
   (`AppTabs`: Goals, Portfolio, Cards, Ask).
3. Pages call loaders in `lib/data.ts` (`loadGoals`, `loadCards`, `loadOnboarding`). They're
   wrapped in React `cache`, so several components on one page share one database round trip.
   `requireUser()` redirects to `/login` when signed out and to `/consent` when the privacy policy
   version changed.
4. Each tab has a `loading.tsx` (`components/page-skeleton.tsx`) so navigation is instant, and
   `components/nav-pending.tsx` shows a strip while the next tab loads.
5. Client components call server actions (`lib/actions.ts`, `lib/cards-actions.ts`,
   `lib/statement/actions.ts`, `lib/ask/actions.ts`, ...) and then `router.refresh()`.

## Routes

| Route                       | What it is                                                             |
| --------------------------- | ---------------------------------------------------------------------- |
| `/login`, `/auth/callback`  | Sign in (invite list checked by a database trigger), privacy consent   |
| `/consent`                  | Re-accept the privacy policy after `PRIVACY_VERSION` changes           |
| `/goals`                    | Start page. Goal list, money plan; updates and imports via +            |
| `/goals/new`, `/goals/[id]` | New goal; one goal with its plan, investments and suggestions          |
| `/portfolio`                | Total value, allocation bar, holdings (tap to edit); updates and imports via + |
| `/cards`                    | Credit cards: unpaid bills first, milestones, card details, card advisor      |
| `/ask`                      | Private Q&A about your own numbers (AI, opt-in)                        |
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
- **`lib/allocate.ts`**: `planMoney` splits "savings now" and "monthly to invest" across goals:
  bills funds first, then dated goals soonest first (just enough to be on time), then goals with no
  date by how much each still needs. `categoryForHorizon` picks the kind of fund for each goal by
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
- **`lib/goal-status.ts`**: presentation only. A goal's status label, its time group (next 2
  years, later, no fixed date), the line under its name, the hint on its card, and `gapOptions`
  (later date, smaller target, extra a month) for a goal the plan can't cover.
- **`lib/fund-goal.ts`**: for a goal with nothing linked, which holdings could be linked and what
  new kind of fund would suit it.
- **`lib/portfolio.ts`**: totals by asset class, holdings with gains where `invested` is known.
- **`lib/cards.ts`**: the current milestone period, spend in it (logged bills in the period plus
  unbilled spend typed in, which stops counting once a later bill is logged), pace needed.
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
