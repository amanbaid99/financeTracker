# Personal Finance Engine: Build Spec

Oct 24, 2026 · @Aman Rajendra Baid

## Overview

A personal finance web app for Aman and a few friends that answers one question: **what should I put my next rupee toward?** Budgeting, insurance, debt, emergency fund and goals are all inputs to that answer.

- **Users:** Aman plus a small invite-only group. Non-commercial, personal use.
- **Core output:** a "Next Focus" card on the dashboard, driven by a rule-based priority ladder (see Priority ladder).
- **Supporting modules:** profile and onboarding, budget by income type, goals with required monthly investment, holdings mapped to goals.
- **Accuracy grows with data:** almost every question is optional. More answers means sharper recommendations, shown through a profile completeness score.
- **Phase 1:** manual inputs and the rules engine. **Phase 2:** CAS (Consolidated Account Statement) upload and AI explanations.

## Guardrails (non-negotiable)

The app suggests instrument **categories** only, never specific funds, AMCs or schemes, and every suggestion carries a disclaimer.

**Investment suggestions**

- Allowed outputs: categories such as savings account, liquid fund, short-duration debt fund, FD/RD, hybrid fund, index/equity fund, PPF, NPS, EPF/VPF.
- Never name, rank or recommend an AMC, fund house, scheme or stock. No "top funds" lists, no ratings.
- Users may enter the funds they already hold. The app maps them to goals and categories but never says "switch to X".
- Category choice comes only from the goal's time horizon and risk profile (see Goals engine), so the logic is explainable.

**Disclaimer**

Shown in the footer of every page that shows a suggestion, and once during onboarding with an "I understand" checkbox:

> This app is a personal planning tool, not investment advice. Suggestions are general, based on asset categories and the information you entered. The creator is not a SEBI-registered investment adviser. Mutual fund investments are subject to market risks; read all scheme-related documents carefully. Consult a registered adviser before making investment decisions.

**Data privacy**

- Supabase Row Level Security on every table from day one: a user can only read and write their own rows.
- No bank or card numbers collected. PAN never stored in Phase 1; in Phase 2 store it masked (e.g. ABCDE\*\*\*\*F) at most.
- CAS PDFs and their passwords are never persisted (see Phase plan).
- Account deletion wipes all user rows.

## Onboarding profile

Only name, age and at least one income stream are required; everything else is optional and raises the completeness score.

Onboarding is a short stepper (one topic per screen, "Skip for now" on every optional step). Every answer is editable later from Settings.

| Step | Fields | Required | Used by |
| --- | --- | --- | --- |
| Basics | Name, age (or DOB), city tier (metro / tier 2 / tier 3) | Name, age | Ladder, insurance sizing, retirement horizon |
| Household | Marital status, number of dependents, are you the sole earner? | No | Emergency fund months, term cover need |
| Income streams | One row per stream: label, type (stable salary / variable salary / freelance / business / rental / other), monthly amount or last 6 months of amounts, in-hand or gross | At least one stream | Budgeting engine |
| Essential expenses | Rent/EMI, groceries, utilities, transport, insurance premiums, family support, other fixed | No (fallback: 50% of base income) | Emergency fund target, budget |
| Insurance | Health: own/employer/family floater, cover amount. Term life: cover amount. Premium and renewal month for each | No | Ladder steps 2 and 3 |
| Liabilities | Type (credit card, personal loan, car, home, education, other), outstanding, interest rate %, EMI | No | Ladder step 4 |
| Savings and holdings | Cash/savings balance, FDs, EPF/PPF/NPS, mutual funds (name + current value), stocks, gold, other | No | Emergency fund progress, goal funding |
| Goals | See Goals engine | No (app suggests Emergency fund and Retirement by default) | Goals engine |
| Risk comfort | 3 questions: reaction to a 20% fall, investing experience, income stability | No (default: moderate) | Category mapping for long-term goals |

**Completeness score:** a weighted percentage. Suggested weights: income 25, expenses 20, insurance 15, liabilities 15, holdings 15, household 5, risk 5. Show the top 2 missing items with a line on why each matters (e.g. "Add your expenses so your emergency fund target is real, not estimated").

## Budgeting engine

The budget is built on **base income** (the money you can count on every month), and anything above it is **surplus** that follows fixed allocation rules. Each income stream is classified by type, so a person with a salary plus freelance work gets both rules applied.

| Income type | Base income | Surplus rule (defaults, user-editable) |
| --- | --- | --- |
| Stable salary | Monthly in-hand | None; whole amount is base |
| Variable salary (incentives, commission) | Fixed component, or lowest month of last 6 if no fixed part | Variable part: 50% to current ladder step, 30% to goals, 20% to wants |
| Multiple jobs | Primary job as per its type | Secondary income: 70% to ladder/goals, 30% wants. Never used for essentials |
| Freelance / business | "Pay yourself" salary = average of the lowest 3 of the last 6 months | Income first lands in a buffer bucket. Tax reserve (default 25%, editable) taken first, then salary, then remainder per the variable rule |
| Bonus / one-off | Not part of base | 50% ladder, 30% goals, 20% wants |

**Monthly split of base income**

1. Essentials (from the expense step).
2. Savings target = max(20% of base, amount the current ladder step and goals need), capped so essentials + savings never exceed 90% of base.
3. Wants = whatever is left.
4. If essentials alone exceed base income, the dashboard shows a cash-flow warning and the Next Focus becomes "Fix monthly cash flow" (ladder step 0).

**Freelancer extras:** show advance tax reminders on 15 Jun, 15 Sep, 15 Dec and 15 Mar, and track the buffer bucket size (target: 3 months of pay-yourself salary).

All percentages live in one config file (see Notes for Claude Code) so they can be tuned without code changes.

## Priority ladder

The Next Focus is the **first step below that is not complete**; the engine evaluates them in order on every data change. Missing data counts as "unknown" and the step is shown as "Tell us about X" rather than assumed complete.

1. **Step 0: Positive cash flow.** Essentials + EMIs are below base income. If not: Next Focus = "Fix monthly cash flow", show the biggest expense lines.
2. **Step 1: Starter buffer.** Liquid savings of at least 1 month of essentials.
3. **Step 2: Health insurance.** Personal or family floater cover (not only employer cover) of at least ₹10L in metros, ₹5L elsewhere, per family unit. Employer cover counts as a bonus but doesn't complete the step, since it ends when the job does.
4. **Step 3: Term insurance.** Required only if dependents > 0 or there are loans someone else would inherit. Target cover = 15x annual income + outstanding loans minus liquid assets. Skipped (marked not needed) otherwise.
5. **Step 4: High-interest debt.** All liabilities with interest above 10% p.a. (credit cards, personal loans) are paid off. Suggest the avalanche method (highest rate first). Home and education loans below the threshold don't block progress.
6. **Step 5: Full emergency fund.** Months of essentials by profile, held in savings, sweep FD or liquid fund categories:
   - Stable salary, no dependents: 3 months
   - Stable salary with dependents, or variable salary: 6 months
   - Multiple jobs: 4 months
   - Freelance / business, or sole earner with dependents: 9 months (12 if both)
7. **Step 6: Goals.** Fund goals by user-set priority, then by nearest date. Retirement always gets a baseline contribution (default 10% of base income) from this step onward, even while other goals are in progress.

**Parallel tracks.** Steps aren't strictly sequential for money: while on steps 2 to 5, the engine still suggests keeping existing SIPs running and only redirects *new* savings. Insurance premiums are treated as essentials once bought.

**Next Focus card** shows: the step name, the gap in rupees, a suggested monthly amount, months to complete at that rate, and a one-line reason (e.g. "An emergency fund comes before investing so a job loss doesn't force you to sell investments at a loss").

All thresholds (₹10L, 15x, 10%, months) live in config.

## Goals engine

Each goal turns a target in today's rupees into an inflated future amount, then into the monthly investment needed in the category its time horizon allows.

**Goal fields:** name, type (emergency fund, insurance premium fund, wedding, house down payment, vehicle, education, travel, retirement, custom), target amount in today's ₹, target date, priority (1 to 5), inflation rate (default by type), current amount saved, linked holdings (zero, one or many).

**Math**

Future value of the target, with inflation i over n years:

```latex
FV = PV \cdot (1 + i)^{n}
```

Required monthly SIP, with expected annual return R (monthly r = R / 12), m months, and current savings S growing at the same rate:

```latex
SIP = \frac{\left(FV - S(1+r)^{m}\right) \cdot r}{\left((1+r)^{m} - 1\right)(1+r)}
```

If the result is negative, the goal is already funded. Show status: On track (projected ≥ 100%), Slightly behind (80 to 99%), Behind (< 80%).

**Horizon to category mapping** (the only investment logic in the app; returns are conservative planning assumptions, editable in config)

| Time to goal | Suggested categories | Planning return p.a. |
| --- | --- | --- |
| Under 1 year | Savings account, sweep FD, liquid fund | 6% |
| 1 to 3 years | FD/RD, short-duration debt fund | 6.5% |
| 3 to 5 years | Conservative hybrid or balanced advantage fund, plus debt | 8% |
| 5 to 7 years | Mix of equity index/flexi-cap category and debt (60:40 for moderate risk) | 9.5% |
| 7+ years | Equity categories (index, flexi-cap); PPF/NPS for retirement | 11% |

Risk comfort shifts the mix one band: conservative users get the next-shorter band's mix, aggressive users can stay longer in equity.

**Glide path:** when an equity-backed goal is within 3 years, flag "Start moving this goal to debt" and suggest shifting about a third of its value each year.

**Default inflation by goal type:** general 6%, education 10%, wedding 7%, house 7%, medical 10%.

**Holdings mapping:** a holding can fund several goals by percentage (e.g. 60% to House, 40% to Retirement). Total allocation of a holding cannot exceed 100%. Unmapped holdings show as "Unassigned" on the dashboard.

## Data model (Supabase Postgres)

Ten tables in Phase 1, every one carrying `user_id` with an RLS policy of `user_id = auth.uid()` for select, insert, update and delete. Money is stored as integer rupees (`bigint`), never floats.

| Table | Key columns | Notes |
| --- | --- | --- |
| profiles | user\_id (PK, FK auth.users), name, dob, city\_tier, marital\_status, dependents, sole\_earner, risk\_profile, disclaimer\_accepted\_at | One row per user |
| income\_streams | id, user\_id, label, type (enum), amount\_monthly, is\_gross, active | Type enum: stable\_salary, variable\_salary, freelance, business, rental, other |
| income\_entries | id, stream\_id, user\_id, month (date), amount | Monthly history for variable and freelance streams |
| expenses | id, user\_id, category, amount\_monthly, is\_essential | Fixed monthly essentials |
| insurance\_policies | id, user\_id, kind (health, term, other), source (personal, employer, family), cover\_amount, premium, renewal\_month |  |
| liabilities | id, user\_id, kind, outstanding, interest\_rate, emi |  |
| holdings | id, user\_id, kind (savings, fd, ppf, epf, nps, mutual\_fund, stock, gold, other), name, category, current\_value, monthly\_sip, source (manual, cas) | `name` is free text the user enters; the app never suggests one |
| goals | id, user\_id, name, type, target\_today, target\_date, priority, inflation\_rate, saved\_amount, status |  |
| goal\_allocations | id, user\_id, goal\_id, holding\_id, percent | Sum of percent per holding ≤ 100 (enforce with a check in a trigger or app logic) |
| settings | user\_id, config\_overrides (jsonb) | Per-user overrides of config defaults |

**Phase 2 additions:** `cas_imports` (id, user\_id, statement\_period, imported\_at, holdings\_count, pan\_masked) and `snapshots` (user\_id, month, net\_worth, per-goal values) for trends.

**Auth:** Supabase Auth with Google sign-in and email magic link. Invite-only: a signup is allowed only if the email is on an `allowed_emails` table (managed by Aman, no RLS read for users).

## Tech stack and hosting

Next.js on a new Vercel project, Supabase in its own project, and the finance rules as pure TypeScript functions with unit tests.

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Recharts for charts |
| Backend | Next.js server actions and route handlers; Supabase JS client with server-side auth |
| Database and auth | Supabase Postgres + Auth, RLS on all tables |
| Hosting | New Vercel Hobby project (personal, non-commercial use) |
| Testing | Vitest for the engine, Playwright for the onboarding and dashboard happy path |
| Phase 2 CAS parsing | Python serverless function on Vercel using the open-source `casparser` library |
| Phase 2 AI | Claude API for explanations only |

**Supabase project:** free plan allows 2 active projects per account. Either pause an idle existing project and create this one in the current account, or use a separate account. Don't share a database with another app. Free projects pause after 7 days with no activity, which regular use avoids.

**Suggested structure**

```
/app
  /(auth)/login
  /onboarding/[step]
  /dashboard            Next Focus card, budget, goals summary
  /budget
  /goals/[id]
  /holdings
  /settings
/lib
  /engine               pure functions, no I/O
    budget.ts
    ladder.ts
    goals.ts
    completeness.ts
    config.ts           all thresholds and defaults
  /supabase             clients, typed queries
/supabase/migrations    SQL migrations incl. RLS policies
/tests/engine
SPEC.md                 this document
```

## Phase plan and acceptance criteria

Phase 1 is complete when Aman can onboard, see a correct Next Focus, and track goals with manual data; CAS and AI wait for Phase 2.

**Phase 1: Core engine (MVP)**

- [ ] Invite-only auth (Google + magic link) with `allowed_emails` check
- [ ] Onboarding stepper with skip on optional steps and disclaimer acceptance
- [ ] Budget page: base income, surplus rules, essentials / savings / wants split per income type
- [ ] Ladder engine with all steps; Next Focus card shows gap, monthly amount, months to complete, reason
- [ ] Goals: create, edit, SIP calculation, status, horizon to category suggestion
- [ ] Holdings: manual entry and allocation to goals by percent
- [ ] Completeness score with top 2 missing items
- [ ] Unit tests for every ladder step, each income type, and the SIP formula (including already-funded and zero-month edge cases)
- [ ] RLS verified: a second test user cannot read the first user's rows

**Phase 1.5: Monthly rhythm**

- [ ] Monthly check-in: log actual income entries and update holding values
- [ ] Net worth and goal progress snapshot each month, simple trend chart
- [ ] Reminders for insurance renewals and advance tax dates (in-app)

**Phase 2: CAS + AI**

- [ ] CAS upload: user uploads the CAMS/KFintech PDF and types its password; the Python function parses it in memory with `casparser` and returns holdings JSON
- [ ] The PDF and password are never written to storage or logs; only parsed holdings and masked PAN are saved
- [ ] Import diff screen: new, changed and removed holdings for the user to confirm before saving
- [ ] Auto-categorise funds by SEBI category from the CAS data; user keeps their existing goal allocations
- [ ] AI explanations via Claude API: plain-language "why this is your next focus" and goal summaries. The model receives computed numbers and explains them; it never calculates, never names funds or AMCs, and its output is prefixed by the disclaimer

**Later ideas (not committed):** shared household view for couples, PWA install with push reminders, export to PDF.

## Notes for Claude Code

Build the engine first and test it before any UI, because every screen just renders its output.

**Build order**

1. Scaffold Next.js + Tailwind + shadcn/ui; connect Supabase; add this spec to the repo as `SPEC.md`.
2. Write migrations for all Phase 1 tables with RLS policies; generate TypeScript types.
3. Implement `/lib/engine` (config, budget, ladder, goals, completeness) as pure functions with Vitest tests.
4. Auth with invite list, then the onboarding stepper.
5. Dashboard with the Next Focus card, then Budget, Goals, Holdings and Settings pages.
6. RLS check with two test users, Playwright happy path, deploy to Vercel.

**Conventions**

- Money as integer rupees; display in Indian format (en-IN, lakhs and crores, ₹ symbol).
- Dates and reminders in IST.
- Every threshold, percentage and planning return comes from `config.ts`, merged with the user's `settings.config_overrides`. No magic numbers in components.
- Engine functions return both the result and a short `reason` string so the UI can always explain itself.
- Never add fund, AMC or scheme names to code, seed data, copy or AI prompts. Category labels only.
- UI copy: plain, friendly English, no jargon without a tooltip, and no em dashes.
- Mobile-first layout; the dashboard must be usable at 375px width.

**Open questions for Aman**

- App name and colour palette.
- Should friends see any shared view (e.g. a group savings challenge), or is every account fully private?
- Health cover thresholds (₹10L metro / ₹5L other) and term multiplier (15x): keep defaults or adjust?
