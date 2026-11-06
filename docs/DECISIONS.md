# Product decisions

Why the app works the way it does. Newest first within each section. When the owner changes
direction, add a line here so the next person doesn't undo it.

## What changed from SPEC.md

SPEC.md was the first build plan (Oct 24, 2026). The app has since moved away from parts of it:

- **No dashboard, budget, priority ladder or onboarding stepper.** The app now starts on Goals.
  Goals, the investments linked to them and the money plan answer "where should my next rupee go".
  The old routes redirect to `/goals`, and `lib/engine` no longer exists.
- **No Home tab.** A short Home summary was tried and removed: the owner wants to land on Goals.
- **Phase 2 is done**: CAS statement import and AI (Ask, card features, fund categories).
- **Credit cards were added** (not in the spec): milestones, monthly bills, a card advisor.
- **Own funds are named.** The spec said category only. The rule now is: never name anything the
  user doesn't hold, but do name the user's own holdings ("₹10,000 into your <fund>").
- **No separate disclaimer step.** It left with onboarding; the disclaimer is in every page's footer.

The spec's guardrails (no named funds to buy, disclaimer, privacy, RLS, deletion) still apply.

## Navigation and layout

- Bottom tab bar with four tabs: Goals, Portfolio, Cards, Ask. Settings is the gear in the header.
- One + button for every add or update action (new goal, update values, log a card bill, plan my
  money, import). Pages keep only their main actions visible to stay uncluttered.
- Goals and Portfolio use the + menu for Update values and Import statement, without duplicate top buttons. Updates open in place on Portfolio. Holdings still open for editing when tapped.
- Add a card lives only in the Cards tab, with a visible button even when cards exist. The + menu has a first-use hint and a replayable guide.
- Details are folded away ("Show details") so a goal shows its headline and verdict first.
- Expanded portfolio reviews show two short takeaways first. Each finding expands for its evidence and explanation; remaining checks and review settings stay folded away.
- Portfolio shows total value, monthly investing, compact allocation, a collapsed review summary and holdings. By kind is folded into allocation details so holdings appear sooner.
- Portfolio shows total value, SIPs and equity share. The "invested vs now" gain box was removed
  at the owner's request; per-holding gains stay in the list.
- Loaders on every tab and a pending strip on tab taps, because navigation felt slow.

## Goals and the money plan

- **Plan by time and priority (Nov 6, owner agreed to the suggested rules):** goals are grouped
  Next month, This quarter, Next 6 months, Within a year, 1 to 5 years, 5+ years, No fixed date,
  . The plan funds bills funds, then emergency savings
  to 3 months of essentials, keeps a fifth of the monthly money for 5+ year goals so retirement
  isn't always last, then nearer goals by group with must-haves first. Each goal can be Must have
  or Nice to have.
- **Goals top section (Nov 6, owner asked):** a summary card (saved, going in a month, a status
  bar with counts) replaces the subtitle line. Status filters were removed. This month leads with
  the monthly amount, with "over your budget" as a small pill. Before a plan exists, the row says
  what the goals still need a month. The time-group chip strip was tried and removed (owner: not
  needed); the group headings stay.
- **Plan page (Nov 6, owner asked):** the plan lives at `/goals/plan`: a summary (monthly total,
  split by plan step), "Where it goes, and why" by step (`Suggestion.stage`), then the This month
  checklist and details. Goals shows one row ("Your plan: ₹X a month", View plan) plus a budget
  link. Saving the plan form opens the plan page.
- **Net worth (Nov 6, owner asked):** holdings minus loans. `net_worth_history` keeps one row per
  day, written by database triggers on holdings and loans (`record_net_worth`, security definer,
  not callable by users), so history needs nothing from the app. Today's point uses live figures
  (loan balances follow their EMI schedule). Card bills are not counted. History starts on the
  day the table was added.
- **Portfolio and Credit simplified (Nov 6, owner asked):** Portfolio's "Where your money is" has
  Asset type and Instrument tabs instead of a separate "By kind" fold. Credit has no All/Loans/
  Cards chips: Payments due shows only when something is due, then Cards, then Loans.
- **EMI Mark paid from the 1st of the due month (Nov 6, owner asked):** earlier, the button is a
  note ("Mark paid from 1 Dec"), and the server refuses early marks too.
- **One way to close a gap (Nov 6, owner's call):** a goal the plan can't cover only shows "invest
  ₹X a month more". The later date and smaller target options were removed to keep it simple.

- **Goal calculator (Nov 6):** "Not sure? Work it out" in the goal form (`lib/goal-calc.ts`):
  retirement corpus as a growing annuity from today's spending, emergency fund as months of
  essentials and EMIs, a home's down payment plus buying costs, or any cost grown with prices.
  AI only suggests a low/typical/high cost from a short description (masked); the app does the
  maths and the person checks and saves.
- **Budget page (Nov 6):** lines read at a glance; tap to edit, + to add to an existing amount;
  auto-filled EMIs and SIPs in a "Counted for you" section linking to where they change; the free
  amount follows unsaved typing.

- **Nov 3:** bills funds labelled Covered are folded under "Covered at your current pace", immediately above reached goals. This uses the saved balance and contributions, not a proposed plan. A shortfall returns the goal to its active time group. Ordinary on-track savings goals stay in the active list. An explicitly opened goal stays visible inside its group. Funding priorities and calculations do not change.

- **Budget, plan only (Oct 31, owner's choice):** take-home income and monthly costs (reusing the
  old `income_streams` and `expenses` tables), with loan EMIs and running SIPs filled in from the
  app. Free to invest = income − costs − EMIs − SIPs. "Your month" sits at the top of Goals, with
  the full page at `/goals/budget`. One tap sets the money plan's monthly budget to SIPs + free.
  **No spend tracking**: the owner's card spends are often for friends who pay back, so actual card
  totals would mislead. Yearly payments stay in bills funds (already a SIP), not budget costs.
- **Ask money questions (Oct 31):** "where should ₹X go?" is answered by `planMoney` for that amount
  (`lib/ask/amount.ts`); the AI only explains the split. Unclear once-vs-monthly is asked first
  without AI. Every ₹ and % in a reply must match the facts (2% rounding); one rewrite is
  requested, then anything left is flagged under the answer.

- **Goals page revamp (Oct 31, owner approved a mockup):** the header shows saved, going in each
  month, and counts by status (need action, behind, on track, not started). Active goals are
  grouped by time: Next 2 years (and bills funds), Later, No fixed date; EMI-covered loans and
  reached goals stay folded. Cards are calm: a status label (`lib/goal-status.ts`), a neutral
  progress bar, "₹X of ₹Y" and one short hint. Orange and red only where something is behind or
  short soon. This replaces the earlier "A little attention / Keep going" grouping.
- **This month checklist** replaces the money plan card. One step per holding (monthly raise plus
  any one-time amount, `planSteps`). Ticking a step is the user's confirmation: it raises that
  holding's SIP and value, links a spare holding to its goals, and takes the one-time amount out of
  the plan (`applyPlanStep`). The step shows Undo for 4 seconds (`undoPlanStep` restores exactly),
  then leaves the list. Steps with no suitable holding show "Add it", which opens a prefilled form.
- **One "What to do" box per goal.** The plan's suggestion, when there is one, replaces the coloured
  verdict. When the plan still can't cover a dated goal, the box says how much more a month keeps
  it on track, with a link to edit the plan.

- Goals now lead with saved and monthly amounts and a money plan. The separate attention-count strip was removed; goal groups already show what needs attention. Before a plan exists, a single compact Plan my money row opens the form. Review your plan opens the SIP details. A visible Plan my money button is shown before a plan exists.
- Goals that need attention or a first investment come first, ordered by the existing date and amount rules. Other active goals follow. Reached goals and loans covered by EMIs are folded away, except for an explicitly opened goal. Overdue loans stay visible. These are presentation groups, not changes to allocation priorities.
- Goal cards show full names, a date, a plain status and one actionable headline. Detailed targets and calculations stay inside the expanded goal. A soft accent panel with a subtle circular motif gives the page a distinctive next-step area while respecting every theme and accent.

- The monthly planner starts with one total monthly budget. One-time savings are optional under an expandable field. The saved plan shows the resulting monthly total and compact investment rows with the final amount to set. Each row expands for current amounts, increases and goal breakdowns. Goal breakdowns and existing investments are folded away. Strategy choices and the full goal breakdown live under Plan details and options, with no view tabs. It initially shows three changes with an explicit count and a way to show all. This is a shorter list, not a phased investment plan.
- Diversified remains the default. Simple is an unsaved strategy using one suitable non-gold holding per goal, combining the same holding across goals. It preserves goal ownership and never makes gold a sole holding. The chosen strategy also controls the goal-level confirmation form, so recording agrees with the preview. Switching strategies does not save anything.
- A goal's investments are holdings linked with a percent, so one holding can pay for several
  goals.
- A goal with nothing linked shows "How to save for it": holdings that suit its timeline, or a new
  kind of fund, opened as a prefilled form.
- The money plan takes "savings now" and "monthly to invest" and suggests amounts per goal. The
  default view is "SIPs to start", which names the user's own funds and when each goal's part can
  stop. "By goal" lists the amounts per goal.
- **Smart split** (owner asked for diversification): a goal's amount is spread over up to three of
  its suitable funds, one per kind, weighted by fit. Details in ARCHITECTURE.md.
- **ETFs count**, with ₹100 minimums, because they can be bought a unit at a time and sold any day
  (owner's point). Gold is capped at a fifth of a goal and kept out of liquid needs (emergency and
  bills funds) because its price can fall when the money is needed.
- **Bills fund**: covers known payments for the next 12 months. One-off payments are "One time"
  (`every_months = 0`), not monthly. The plan only asks for what's missing given the balance,
  never the full monthly need again.

## Credit: loans and cards

- **Oct 31: remove manual unbilled spending** (owner's request). There is no "Spent since your last bill" field. Milestone progress uses logged bills only, still excluding card-loan EMIs. Older unbilled values are retained in the database but are neither loaded for the UI nor counted. Progress updates when a statement is logged, not between statements.

- **Oct 31: loans tracked on their own** (owner's request). The Cards tab became **Credit**, with
  Loans then Cards. A loan has a type (home, personal, car, education, gold, loan on a credit card,
  other), amount withdrawn, EMI, rate, total EMIs, EMI day, what's owed now, and for card loans
  the card, bill day and payment day. **Mark paid** lowers what's owed straight away (owner chose
  this): the payment is stored with the previous figures, and only the latest payment can be
  undone, which restores them exactly. EMIs older than a week that weren't marked are assumed paid,
  as the schedule already does. Existing pay-off goals were converted to loans; a goal reads its
  linked loan, and saving the goal updates it. Card-loan EMIs are left out of milestone spend.

- **Oct 31:** each card's header leads with its first unpaid bill and how soon it's due
  (`dueLabel`: overdue/today in red, within 3 days in amber), with **Mark paid** on the header
  itself. The annual fee moved into the card's details.

- Bills come first on each card. Cards and bills are sorted for display: overdue, dated unpaid, undated unpaid, then paid. Old unpaid statements stay visible before newer paid ones. Missing due dates are never assumed overdue. Card names wrap, payment labels say Mark paid, and the advisor explanation is folded under Why this card. Calculations and explicit save steps stay the same.
- Milestones show "Counted from N bills". Eligible spend comes from logged statements in the milestone period, excluding card-loan EMIs.
- Card features can be read from a PDF or a description by AI, but every fact is shown for the user
  to confirm before it's saved.

## Statement import and value updates

- **Oct 31 (owner's request):** after reading a CAS the confirm step asks "Do these values look
  right?". Any update that fell 10% or more (and ₹1,000+) asks "Did you take money out?" and must
  be answered. Yes lowers the amount invested by the same share when the statement doesn't give
  one (`lib/withdrawal.ts`), so a withdrawal never shows as a loss. After saving, a "What changed"
  list (`lib/statement/insights.ts`, no AI) shows growth net of withdrawals, withdrawals, best and
  worst movers, SIP changes and new funds without a goal. Update values asks the same question
  when a value with a known amount invested falls that much.

## AI

- Portfolio reviews are a separate opt-in, also requiring AI to be enabled and current consent. Confirmed CAS imports trigger a full review. Holding and balance updates run basic checks; AI runs on first review or meaningful change. Changes are compared with the last successful AI review, so small changes accumulate: 10% total value, 5 percentage points in an asset class or holding, changed SIPs, holdings, goal status or flags.
- The app calculates portfolio facts and findings. AI receives only codes, fixed asset categories, rounded totals and check types, then prioritises existing findings. Its entire output is validated; it cannot invent numbers, products or findings. Failure falls back to app checks without affecting a successful holdings save. No personal names, identifiers or CAS documents are sent.
- Reviews run after the save response and are stored per user under RLS. A revision check stops an older job overwriting a newer one. Turning off reviews invalidates pending results. Failed and successful AI attempts count toward the review limit.
- Rebalancing currently flags concentration and near-term risk, favouring new contributions before sales. No age-based target or automatic trades. Target allocation needs user confirmation based on goals, cash needs and risk comfort, with age as supporting context. Same-category funds do not prove underlying overlap.

- Free models first; paid only as a fallback or tie-break, under a daily dollar cap and a per-user
  cap. The owner added credit to OpenRouter for this.
- Nothing personal goes to AI (see AGENTS.md rule 2). AI output never sets numbers on its own.

## Look and feel

- **Oct 31:** Settings saves the theme and accent on tap (no Save look button); Delete account is
  folded. Ask's consent screen is two lines plus example questions, with the full "What's sent"
  list one tap away. Import has a tap-or-drop upload area and returns to Portfolio when opened
  from there. The separate "+ button" hint bubble is gone: each tab's guide covers it.
- "Match phone" theme was built and then dropped at the owner's request.

- Calm and simple: fewer boxes, more white space, motion on sheets and tabs (reduced-motion
  respected).
- 10 accent colours, light and dark themes, all contrast checked.
- Copy: friendly, short, no jargon, no em dashes.

## Later

- **Card statement analysis** (owner's idea, Oct 31): upload a card statement, get a breakdown, and
  for spends the app can't place (often UPI) ask the owner what they were, including "a friend
  will pay me back", which shouldn't count as spending. Not started.

- **Nov 3: compact home and consistent surfaces** (owner approved). Budget and plan share This month, with available and planned monthly totals labelled separately. Budget details are folded, and only two investment steps show initially. Status counts are filters, including covered and reached goals; filtering opens matching folded groups. Behind today describes the current position, while Covered by your plan describes the proposed change. The + action is docked in the centre of the bottom navigation. Native modal sheets contain keyboard focus and return it on closing. Checklist Undo lasts 10 seconds. Finance calculations and explicit save actions stay the same.

- **Nov 3: portfolio overview** (owner approved). Total and allocation share a card. Asset buttons filter holdings; search matches name and kind. Sort by value, name or simple percentage growth, with unknown growth after known losses. Portfolio shares continue to refer to the whole portfolio. Reviews remain folded in a compact row. Holding names use two lines, and + on Portfolio can add a holding. Record edit dates use holdings.updated_at in IST and never imply a market price date. settings.last_cas_import_at records successful imports with saved changes from this release onward. Historical import dates stay unknown; failed or skipped imports do not set it. Existing settings RLS protects the nullable field.

- **Nov 3: payments-first Credit** (owner approved). A due list combines unpaid statements and next EMIs by date; undated bills come last. Linked card-loan EMIs are informational reminders when statements are missing, never a second payable amount alongside unpaid card bills. Recording an EMI still updates its loan balance separately. All/Loans/Cards filters retain open state. Closed loans, paid bill history, completed milestones, calculation explanations and card suggestions are folded away. Bill entry always shows due date and never assumes older bills are paid. Mark paid has page-level confirmation and 10-second Undo; paid labels are read-only and can be changed through Edit bill. Loan forms fold original borrowing and closure charges. Loan balances and elapsed EMI counts remain schedule estimates, with recorded payments listed separately. No finance calculation or automatic payment is introduced.

- **Nov 3: current-month due list** (owner correction). Payments due stops at the end of the current IST month. Overdue and undated existing bills remain visible. Future card bills and next-month EMIs stay in their own card or loan, keeping their dates and payment actions intact. The cutoff uses the injected today, including December to January.

## Speed

- **Nov 6:** pages load all of the signed-in person's rows with one call to `app_snapshot()`
  (security invoker, so RLS applies), cached per request and shared by layout and page. Before,
  the Goals page made ~13 REST calls and Portfolio/Settings waited on sequential batches; the
  small database slowed each to 70-250 ms under that burst. Add new page data to the snapshot
  rather than a new query.
