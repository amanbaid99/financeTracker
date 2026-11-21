# Product decisions

Why the app works the way it does. Newest first within each section. When the owner changes
direction, add a line here so the next person doesn't undo it.

## Focused Goals and Budget views, 21 Nov 2026

The owner asked to simplify both pages and remove repeated controls and facts. Goals owns goal progress; Home owns update reminders and Your plan owns monthly allocation/checklists. Preserve all goal actions and calculations, but show exact math only when requested. Covered goals are always a separate bottom section, never included among the first three focus goals. Budget shows three totals, one header Edit action and the requested Create a SIP plan action. Rebuild/reset are secondary maintenance options, not permanently exposed actions. Do not offer an empty expansion that only repeats a bucket total. Between-jobs warnings remain accessible and date-sensitive refresh must survive UI simplification.

## Home is a concise overview, 21 Nov 2026

The owner wants Home simplified, with fewer repeated options and facts. Keep one clear balance hierarchy, one actionable update reminder, three ordered focus goals and the closest unfinished milestone. Put extra-money access inside the balance card and retain the global + shortcut. Make section content itself navigable, rather than repeating View all/Cards/holdings links. Hide empty milestone placeholders, preserve one first-goal entry and a quiet all-covered state. Keep detailed holdings, goal and milestone data in their respective tabs.

## Loan records survive goal deletion, 21 Nov 2026

A payoff goal and its underlying liability have separate lifecycles. Deleting the goal must not silently imply repayment or erase loan history. Every loan therefore needs management independent of its goal. Offer explicit closure/foreclosure with zero confirmed balance and retained history, plus permanent removal of unlinked loans after a destructive confirmation. Hide closed loans from active debt and EMIs. Loan-linked budget rows for closed/deleted loans must also leave the budget view. I have extra money is a prominent global + action and Home shortcut to the existing read-only allocation preview, with explicit Add to my plan required for writes.

## Always show the complete monthly SIP checklist, 19 Nov 2026

The owner wants every item in This month visible immediately. Remove the two-row limit and expansion controls; keep confirmation and Undo behaviour unchanged.

## SIP planning is an explicit budget action, 19 Nov 2026

The owner wants the estimate calculator removed and an option to create a SIP plan using Save & invest after calculation. A separate review screen is prefilled with the combined amount, with a smaller amount allowed to retain savings. Reuse the existing goal allocation engine and saved monthly money-plan field. Do not automatically link every saved budget. Only Save SIP plan changes the monthly plan; preserve existing lump-sum input and existing SIP amounts. Existing SIPs exceeding the chosen budget must be reconciled before saving.

## Personal estimate option removed, 19 Nov 2026

Removed the Help me estimate calculator from guided setup and monthly editing at the owner's request. The optional manual Personal spending field and standard recommendation remain. No budget amounts or stored records are changed.

## Commitments first, paired questions later, 19 Nov 2026

The owner does not want groceries, day-to-day costs or transport prefilled in the first list. Defer them rather than removing records: ask groceries among later monthly Essentials, and transport/everyday personal use in Personal spending. Present up to two missing cost questions per screen, with blank amounts allowed and no automatic defaults. Keep tracked loan commitments in the confirmation list. Existing saved budgets remain intact until the owner saves a replacement.

## Personal spending includes transport and daily costs, 19 Nov 2026

The owner wants Personal spending rather than a purely discretionary guilt-free bucket. Combine personal transport, everyday personal use and fun. Offer a transparent routine-based calculator rather than a fixed required percentage: monthly transport plus daily personal spending times chosen days plus monthly fun. Leave household Essentials out to avoid double counting. Include existing named personal costs within the envelope and disclose when they set a minimum. Accepting an estimate updates the proposal, not saved data; Save & invest adjusts and the user confirms Save. Old recurring transport labels can be grouped in the view, but loan EMIs and general travel goals are never reclassified.

## One Save & invest bucket, 19 Nov 2026

The owner wants Save & invest as one budget bucket and annual contributions left in Goals. Use exactly three visible buckets: Essentials, Save & invest and Guilt-free spending. Remove annual and buffer questions because the budget no longer chooses a cash-versus-investing split. Recommend a combined monthly rupee target and keep it fixed unless edited; expense changes affect spending room. Existing separate allocations are grouped without rewriting data; editing/rebuilding requires explicit Save. Rebuilding excludes old annual provisions rather than creating another contribution beside Goals.

## Guided, independent budget creation, 19 Nov 2026

The owner wants recommendations rather than selecting ratios, a conversational setup and a compact saved view. Adopt a conscious-spending inspired four-bucket plan, without claiming an optimal or certified industry ratio. Known expenses require confirmation; essentials include necessary commute. Annual bills are monthly savings provisions. Ask only buffer status and an optional desired spending amount, not saving/investing percentages. Default spending starts at 25% of income capped at half the available money after essentials/provisions. Split future money 60/40 toward savings/investing while building a buffer, 40/60 otherwise; all amounts are editable and assumptions disclosed. Infeasible spending preferences and income shortfalls are shown honestly. The final save locks rupee targets, independent of goals and SIP records. Use local calculations rather than an AI dependency for reliable arithmetic and private cost names. Existing budgets survive cancellation and failures; rebuilding replaces allocations only on explicit final save. Four collapsed rows replace the permanent item editor and repeated goal prompts.

## Stable savings and investing targets, 19 Nov 2026

The owner approved four sections: Commitments, Savings, Investments and Personal spending. Set category targets once, default to editable percentages based on existing allocations, and allow fixed rupees. Existing users explicitly confirm before adoption; no forced ideal ratio or automatic conversion. All income left after commitments and targets belongs to Personal spending, including commute, personal costs and Free to spend. Deleting costs changes personal balance only. Existing future allocations count toward targets rather than being duplicated; items above targets must be reconciled explicitly. Shortfalls never shrink targets or erase costs. This supersedes the proportional remainder proposal.

## Budget remainder proposals, 19 Nov 2026

The owner wants freed budget money automatically proposed across savings, investing and guilt-free spending for approval. Keep the simplified single-sheet Budget and replace the two destination buttons with an editable inline proposal. Use existing category proportions, including zero shares; use 40/40/20 only without an existing mix. Never silently accept or save. Acceptance adds dedicated allocation rows without rewriting existing commitments or percentage bases.

## Working assisted budget setup, 19 Nov 2026

The owner expected the proposed Help me build my budget option to be available. It is now an explicit opt-in entry below income, alongside the manual sheet. Three steps confirm income/known items, collect missing expenses and review editable extra allocations. Current draft amounts are preserved unless the user changes or deselects them. Recorded-cost IDs and matching existing expense names prevent common duplicates; ambiguous EMI records start unchecked. Previously excluded loan rows require explicit inclusion. Known SIPs appear once, and are unchecked by default if current future-money allocations may already cover them.

Only the remainder after confirmed items is allocated. Existing personal spending is kept; otherwise an editable starting amount uses 20% of the remainder. Known non-loan goal gaps guide future allocations and an unfinished emergency goal gets first priority toward its savings pace. Unknown/surplus future money uses a disclosed editable starter split. Nothing creates or changes an actual SIP or payment. A plan that already fits can be kept without manufacturing extra allocations.

One final Save this budget uses the existing owner-scoped budget action. Cancelling leaves manual drafts and saved data untouched; failed saves retain the proposal. Income shortfalls and allocations exceeding available money block assisted completion. Stable assisted row IDs avoid repeated-run duplication. No external AI or schema change is used.

## Confirmed budget reset, 19 Nov 2026

The owner needs a way to start the budget over. Reset budget is a separate confirmed action at the bottom of Budget. It deletes only the authenticated owner's `budget_ratio_plans` document, discards local unsaved edits and opens the normal fresh sheet with recorded take-home income and active EMIs. Loans, investments, SIPs, recorded income, goals and cards stay intact. The confirmation previews the starting income and states that reset cannot be undone. Closing or cancelling performs no deletion; a failed reset keeps the current draft visible.

The server requires an explicit confirmation literal and obtains the owner from the authenticated session, not client input. Existing owner-only DELETE policy/grants apply; no schema migration is needed. This feature adds a user-controlled app action and does not reset the owner's hosted budget from the workspace.

## Expense presets and fixed costs, 19 Nov 2026

The owner wants quick expense choices such as Utilities, EMI and Custom, with fixed costs visible inside Expenses. New expense entry starts with a preset dropdown. Rent, utilities, EMI, insurance and subscriptions default to fixed; groceries/transport are variable and personal spending keeps its category. Custom defaults to fixed and exposes name/type fields. Existing rows are never reclassified automatically.

Expenses shows Fixed costs and Variable & other expenses subtotals without changing the three main budget sections or stored format. An EMI preset is disabled when tracked loan rows are already in the draft; separate untracked payments can use Custom. Savings/investment entry and direct amount/percentage editing remain unchanged. All edits still require Save budget to persist.

## Grouped budget sections, 19 Nov 2026

The owner wants the budget list and adding flow organised into Expenses, Savings and Investments. Existing fixed/variable/debt/personal categories belong to Expenses; savings and investing each have their own section. Each section shows its total and income share and has a typed Add action. No storage format or amount calculation changes.

Names and types are readable text rather than permanent input controls. Amounts and percentages remain editable inline. A small panel handles adding, renaming, changing type and removing items; changing type moves an existing row into its section. Add actions preset the section category. Closing a panel cancels local edits and avoids leaving unnamed rows. Updating a panel changes the budget draft only; Save budget remains the persistence action. Loan removal/restore and undo keep their existing semantics.

## Balanced allocation review, 19 Nov 2026

The owner wants a category allocation bar and supportive, evidence-based insight on salary and goals, not continual criticism. The top review groups the current manual rows, includes unassigned income and updates locally during edits. Above-income plans use planned spending as the bar denominator, while legend percentages remain shares of income and the changed scale is labelled explicitly.

The review has no fixed ideal ratio, score or automatic adjustment. It recognises income fit, saving/investing capacity, personal spending and tracked emergency targets where appropriate. Goal comparison uses current SIP plus calculated extra SIP for unfinished non-loan goals with a known finite positive pace, without adding these amounts to the budget or claiming assignment. Unknown goal pace is disclosed. Overspending receives a clear primary warning and cannot get a healthy overall verdict. Two notes are visible, with additional context and any third note folded below. No external AI, new schema or user-record writes are required.

## Manual spreadsheet budget, 19 Nov 2026

The owner replaced ratio suggestions, the wizard and nested bucket editing with a manual sheet. Each row has a name, category and either a rupee value or percentage as its last-edited basis. The other value is derived, preventing drift. Salary changes retain rupee entries and resize percentage entries. Categories are fixed expense, variable expense, investing, savings, debt repayment and personal/guilt-free. Partial and over-budget plans are valid, with explicit totals and excess labels.

The owner now explicitly permits automatic loan inclusion, superseding the previous opt-in decision. Active EMIs are added once as editable fixed-expense rows; removed loan IDs are remembered, and a restore action is available. Existing edited amounts are preserved. Closed/deleted loan rows leave the loaded draft. Nothing is written until Save budget.

Version 2 uses the existing owner-scoped JSON table, with no SQL migration. Old main/child allocations flatten into rows. Scheduled EMIs consume old debt allocations first, avoiding duplication; an existing shortfall is shown rather than silently normalised. Old JSON stays unchanged until the user saves the converted sheet. Recorded income/cost/goal-plan tools move to `/goals/budget/records`, linked quietly below the sheet. Loans, holdings, SIPs and recorded income are not rewritten.

## Simpler budget and explicit EMI choice, 19 Nov 2026

The owner wants running loan EMIs offered as optional budget inputs instead of automatically counted. Ratio plans now store `includedEmiIds` in the existing JSON document, defaulting to an empty list for old and new plans. Approval is per loan, so a new loan is not included automatically. Main suggestions, debt detail suggestions, budget warnings and the Budget tab's recorded-commitment summary use only the selected EMIs. Existing saved ratios are preserved. Loan schedules, payoff goals and the separate conservative goal money-plan calculations are unchanged.

The editor is now Salary, Split, Review. Main buckets are compact rows; tapping a name opens a separate allocation panel. EMI selection is unchecked until chosen, applies only with Use selected EMIs and is saved only with the budget. Closing the chooser cancels its pending selection. Cancel changes restores the saved plan and EMI choices. No schema migration or financial-record rewrite is needed.

## Ratio budget planner, 18 Nov 2026

The owner requested one saved monthly budget with salary, custom percentage buckets and smaller allocations within each bucket. Main ratios total 100%; child ratios share their parent and may total less than 100%, leaving visible unassigned money. Amounts use integer rupees with deterministic rounding. Defaults and suggestions are editable before Save budget.

Suggestions use recorded costs, scheduled EMIs and existing SIPs once, then split remaining money between savings and investing. Unfinished emergency savings receive more of the remainder. Goal details follow the existing goal order and monthly needs; completed goals are excluded. This uses local calculations, not external AI. Saving the ratio plan does not change income, expense, SIP, loan-payment or goal records. The existing tools remain under Recorded income and commitments.

One owner-scoped `budget_ratio_plans` row stores the document. RLS protects all CRUD operations and account deletion cascades to it. The server validates ratios, IDs and ownership of goal links. The schema migration must be applied before publishing the UI.

## Current direction, 18 Nov 2026

The owner replaced Investment Radar with a compact Home page at `/today`. Home is the start page and shows current net worth, the first three unfinished goals in the shared goal order, the unfinished card milestone with the smallest eligible spending amount left and existing updates due. Five tabs are Home, Goals, Net worth, Budget and Cards. The plus button remains sticky at bottom right. This overrides older no-Home and Radar decisions below.

Portfolio uses current recorded balances only. Upload CAS for funds and ETFs; manually update other balances. No invested-versus-current, gain/loss, price refresh or performance chart controls. CAS identity and units safeguards remain internal, and every import still requires review and confirmation. Goal progress remains. Archived Radar libraries and stored financial records are retained, but Radar pages and actions are unavailable. No broker token is needed for the active app.

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
- **Next step, not a permanent plan card (Nov 6, owner asked):** Goals shows one Next step card
  only when there's something to do, in this order: set up this month's SIPs (plan with steps),
  set a budget (no plan, no income), start a SIP plan (no plan). "Not now" hides that step on the
  device (localStorage). "I have extra money" (+ menu, `?do=extra`) shows where a one-time amount
  goes with `planMoney`, and adds it to the plan only on "Add to my plan". The + menu's "Plan my
  money" became "Edit SIP plan". The summary card links to Your plan and Budget.
- **Plan page (Nov 6, owner asked):** the plan lives at `/goals/plan`: a summary (monthly total,
  split by plan step), "Where it goes, and why" by step (`Suggestion.stage`), then the This month
  checklist and details. Goals shows one row ("Your plan: ₹X a month", View plan) plus a budget
  link. Saving the plan form opens the plan page.
- **Net worth (Nov 6, owner asked):** holdings minus loans. `net_worth_history` keeps one row per
  day, written by database triggers on holdings and loans (`record_net_worth`, security definer,
  not callable by users), so history needs nothing from the app. Today's point uses live figures
  (loan balances follow their EMI schedule). Unpaid card bills count as owed (Nov 7, owner
  agreed): `card_bills` column and a trigger on `card_bills`; the card shows loans and card bills
  apart. History starts on the
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

- **Nov 16: Roadmap (D)** (owner asked): `/goals/roadmap` shows the plan as steps from "You are
  here": first salary and "savings goals restart" when between jobs, bills months over ₹5,000 (or
  short) for the next year, loans paid off at their EMI end date or closed early by a goal's date,
  and each savings goal at its date (undated ones at the end). Green on plan, grey on hold, amber
  needs you; reached goals and closed loans fold into Done so far. Built from existing data by
  `lib/roadmap.ts`; nothing is stored.
- **Nov 16: between jobs, covered till salary, your order** (owner chose A, B, C from a review
  focused on anxiety). Salary dates (`profiles.salary_best` / `salary_worst`) turn on "between
  jobs": savings goals that need money show "On hold till salary" (muted), not Behind, and the
  Next step card is quiet; bills funds and loans keep their real state (`onHold` in
  `lib/goal-status.ts`). "Covered till salary" (`lib/runway.ts`, card on Goals,
  `/goals/runway`) compares liquid money (savings, FDs, liquid funds, goal-linked ones included)
  with everything due till each salary date: EMIs from loans, living costs from the budget
  (pro-rated by day), bills-fund payments, and your own items (`runway_items`: card dues, money
  owed to you). A bills-fund line that looks like an EMI or living costs already counted isn't
  counted twice; `profiles.runway_choices` remembers when you say otherwise. The weekly amount is
  living costs per week, trimmed only when short. Money owed to you is shown apart until
  received. Your order (`goals.plan_rank`, `/goals/order`) replaces the app's plan rules
  (emergency floor, the long-term fifth, time groups): each goal gets what it needs to be on time,
  top first; an undated goal is built over 24 months; bills funds stay first. Must have / Nice to
  have still applies when no order is set.
- **Nov 12: playbook gaps filled** (owner chose from the App Starter Playbook review):
  error boundaries (`app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx`) with Try
  again; a small service worker (`public/sw.js`) that caches only built files and serves
  `offline.html` when there's no connection (pages and data are never cached); a searchable Help
  page from `lib/help.ts`; a What's new archive at `/whats-new`; a spotlight tour
  (`lib/tour.ts`, `components/tour.tsx`) started from Settings, and "Show me around" in What's new
  for items with `show`; Back that returns to the exact previous screen (in-app history in
  sessionStorage, else the parent page); drafts for new goals and loans in localStorage with
  Restore or Discard; a shared toast (`components/ui/toast.tsx`) used for Mark paid with Undo; a
  GitHub Action for lint, types, unit and Python tests; a test that fails on em dashes; and
  docs/STATUS.md and docs/SETUP.md. Not chosen: export, soft delete, feedback form, /demo,
  analytics. The tour isn't shown automatically, since first-visit guides already greet new users.
  The owner approved the "Help, a tour and a safer app" What's new wording on 12 Nov.
- **Nov 8: Net worth page** (owner asked): the Portfolio card shows today's figures only (no
  chart, so nothing to tap by mistake) and links to `/portfolio/net-worth`: three `TrendChart`s
  (net worth, what you own, what you owe), each scaled to its own range, then own by asset class
  and owe by loan with repaid progress.
- **Nov 8: Home removed, card bills log-only** (owner asked; supersedes the Nov 6 to 8 Home
  entries below). Goals is the start page again, `/overview` redirects to it, and + is back in
  the centre of the bottom bar (Goals, Portfolio, +, Credit, Ask). Net worth sits at the top of
  Portfolio and is holdings minus loans: card statements are logged (month and amount) only to
  count toward milestones, never as money owed, because counting them inflated debt and the bank
  balance that pays them isn't tracked. New bills save as settled with no due date; the old
  `due_date`/`paid` columns stay but nothing reads them. Credit lists Cards, then Loans; there's
  no separate Payments due list (each loan shows its next EMI with Mark paid). The net worth
  trigger on `card_bills` was dropped and history corrected.
- **Nov 8: Due this month on Home** (owner chose ideas 1 to 3): card bills and EMIs overdue or
  due this month (`creditPayments`, linked card EMIs left out) against liquid savings
  (`isLiquid`: savings, FDs, liquid and overnight funds, goal-linked ones included), and how many
  months the rest lasts at budget costs + EMIs (`cashCheck` in `lib/home-summary.ts`). Bills-fund
  payments aren't added, since their funds already hold the money. Each payment has Mark paid
  (same confirm and Undo as Credit). It replaces "Payments coming up".
- **Nov 8: Home is the default tab** (owner asked). Old routes redirect to `/overview`, and a
  fresh launch of an installed app that opens on `/goals` (its remembered start URL) moves to
  Home once per launch. Tapping the Goals tab is never redirected.
- **Nov 7: Home fixes** (owner asked): the net worth chart picks a day only on a tap (not when a
  scroll starts), with Back to today; a flat history shows a note, not a line. Next step sits under
  net worth. One card tile (bills to pay, or the statement total when all paid). The budget tile
  shows only once there's income (Next step asks for it otherwise). Goal progress skips loans and
  uses Goals' "Behind today". + slides away while scrolling down.
- **Nov 6: Home overview** (owner approved). /overview is the new landing page and PWA start URL. /home remains a legacy redirect, now to /overview. The logo, completed sign-in and privacy acceptance open Home. Bottom navigation has Home, Goals, Portfolio, Credit and Ask. + is fixed above the bottom-right corner on the main pages and stays visible while scrolling; page-end padding leaves room to reach the last items. Net worth and its recorded history move from Portfolio to Home, keeping the investments-minus-loans definition and showing card bills separately. This month shows budget free-to-invest after existing costs, EMIs and SIPs; current SIPs; the latest logged statement month with card coverage; and unpaid card bills. No statements is an unknown, never zero live spending. No future statement month is used as the latest month. Payments preview reuses the current-month cutoff and linked-EMI handling from Credit, with payment actions kept there. Home previews three active goals and hosts the dismissible Next step. Goals keeps progress, plan links and the explicit plan form. The existing cached snapshot loaders and history provide the data; no schema or user data mutation is needed to show Home.

- **Nov 16: card milestones visible** (owner asked). Every card shows all of its milestone progress without expanding. Reached milestones stay visible below unfinished ones within the card. Cards with at least one milestone and every milestone achieved move to the bottom, with stable order within each group. A mixed card stays active, and an expired unmet milestone is never labelled reached. States use today's period, so reset milestones move back up. Statements, card management and calculation explanations remain expandable. Legacy statement payment flags do not affect this ordering.

- **Nov 16: simpler milestone copy** (owner correction). Annual fee waiver describes the target, never a promise that the bank has waived the fee. Point rewards use grouped numbers such as 10,000. Rows show the target name, amount left out of the target, one neutral progress bar and deadline; green and Target reached mark completed spend targets. Eligible spend and the required monthly pace stay under How this is counted. Formatting is presentation-only and does not rewrite saved reward descriptions.

- **Nov 16: monthly updates** (owner approved). One compact Updates due section on Goals, with a count, one action and tomorrow snooze stored in settings. Configured card statement day determines the latest generated statement month, clamped at month end. No guessed statement dates or card payment tracking. Loan updates start on the 2nd and CAS on the 5th, carrying forward until saved. Payment flags and old one-off payment records belong to removed flows and do not trigger nudges. Missing information never means a missed payment. Loan balances remain schedule estimates until the user explicitly confirms a lender balance, then the balance stays fixed until the next manual update. Future repayment projections remain estimates. No existing balances are silently reclassified as confirmed.
- **Nov 16: CAS review parity**. Review shows cost changes independently from current values, including proportional cost reductions on an explicitly confirmed withdrawal when CAS cost is missing. Existing cost is otherwise preserved. An unchanged import can still be confirmed as a refresh.

- **Nov 17: personal Radar foundation** (owner requested and chose INDmoney). Radar is an owner-only research watchlist, separate from holdings. A dedicated entitlement, server checks and RLS enforce access, not just a hidden tab. User-selected outside instruments are allowed for Radar research; the planner's category/own-holdings rules remain. The owner gets five tabs and a floating QuickAdd so the mobile bar stays readable. INDmoney's token lives server-side in Vercel and the adapter only calls instrument and daily-price GET endpoints. Live scoring remains Insufficient Data until calendar, adjustment, fundamental and ETF requirements are verified. Saved thresholds do not enable monitoring or Telegram; those and backtesting remain future PRD work.

- **Nov 17: price rules alongside research** (owner asked for Buy/Hold/Sell). Rule labels express explicit saved entry/exit triggers and carry the closing-session date. They do not replace or imply completion of balanced research scoring. No automatic opt-in, position inference or automatic orders. Sell requires confirmed ownership and an exit threshold; Hold means an existing exit rule did not fire. ETF entries have independent NAV/spread guards, and quote timestamps are never invented from request time. Official AMFI NAV uses exact ISIN matching, with no name fallback. Corporate-action-dependent drawdown triggers remain paused.

- **Nov 17: Gold paper implementation** (owner asked to start the missing research). A first deterministic Gold model and a cash-flow/cost-aware historical replay harness are implemented for testing. Proposed guardrails are explicit and are not validated score weights. Paper candidates do not become live Buy calls. Missing sources and unfinished model/validation work are labelled separately; another refresh cannot complete development. No new paid provider is selected and no credentials are requested in chat. Hold and exit decisions still need portfolio context.

- **Nov 17: historical NAV data path** (owner asked to proceed with the next milestone). MFapi is a free secondary history source, anchored to official AMFI scheme code, exact ISIN and latest same-session NAV. It receives only public scheme code and dates, never the broker token or user details. History is attempted only on explicit refresh and lives in the immutable snapshot. Its unknown publication times and adjustments do not pass model gates. Benchmark, adjusted-history and dated-depth coverage remain blockers; the existence of a public page is not verification of an API.

- **Nov 17: actual market-data diagnostics** (owner shared live history and asked to proceed). Compare dates, not counts or row positions, without filling NAV gaps. Keep existing snapshots unchanged. New depth reads use the dedicated market endpoint and preserve safe failure categories, so empty books, access failures and source errors are distinguishable. No timestamp or adjustment proof is inferred from a successful request. The selected Gold ETF's published policy identifies MCX as the designated polled-price source; do not substitute another exchange or a futures series without matching methodology.

- **Nov 17: stock and ETF scope** (owner explicitly asked). Shared source checks cover individual stocks and ETFs, with separate model eligibility. Stocks collect depth without a NAV request. ETFs outside current Gold/index support retain available ETF data and a model-unavailable label; they never use stock or Gold assumptions by default. The legacy watchlist type constraint remains unchanged, while derived instrument kind and explicit other_etf analysis inputs govern actual source/model routing. A legacy equity tag cannot bypass manual ETF entry guards. Full stock, index and other-ETF recommendations still require distinct verified data and models.

- **Nov 17: optional stock report source** (owner asked to continue source work). Prepare IndianAPI's starter-tier report connection as a supplemental source, not a replacement for INDstocks market data. A separate server-only key is required and no paid plan is purchased. Match the exact current NSE ticker; map a BSE instrument only by an unambiguous same-ISIN counterpart. Retain partial successes, cap each collection at four source reads and reuse successful/partial collections for 24 hours with their original timestamp. Unknown publication dates, ISIN verification, currency/units and consolidation basis remain explicit blockers. Do not copy analyst recommendations or treat reports as validated stock valuations.

- **Nov 18: experimental insight alongside gated research** (owner chose the faster route over the full validation standard). Each Radar item shows an "Experimental insight" lean (Buy candidate, Watch, Wait for unowned; Add on dips, Hold, Review selling for owned) from transparent signals: price vs 200-day average, 50 vs 200-day average, RSI(14), position in the one-year range, close vs same-session NAV for funds, and the paper stock score when its inputs are complete. Every reason is listed, the card says it isn't a tested model or investment advice, and the gated automatic research result (still Research not ready) is unchanged beneath it. The price-alert form suggests buy, take-profit and exit levels from the instrument's own year of prices; nothing is saved until the owner picks a level and presses Save. Code: `lib/radar/insight.ts`.

- **Nov 18: reliability of experimental Radar and CAS units.** Experimental signals still require the latest completed session on the verified exchange calendar. Outdated prices remain visible with dates but cannot trigger actionable insights, levels, dip quantities or reached prompts. Date checks update when returning to the app and across the IST day boundary. Explicit fully redeemed fund entries in CAS are offered only against an existing exact-ISIN holding and require the normal review/confirmation. Never add an unheld closed fund or clear an active aggregate position because one folio is closed.
