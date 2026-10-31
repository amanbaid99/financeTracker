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
  verdict. When the plan still can't cover a dated goal, the box offers a later date, a smaller
  target (each opens the goal form prefilled; the owner wants to check and save) or a bigger budget.

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

## Cards

- **Oct 31:** each card's header leads with its first unpaid bill and how soon it's due
  (`dueLabel`: overdue/today in red, within 3 days in amber), with **Mark paid** on the header
  itself. The annual fee moved into the card's details.

- Bills come first on each card. Cards and bills are sorted for display: overdue, dated unpaid, undated unpaid, then paid. Old unpaid statements stay visible before newer paid ones. Missing due dates are never assumed overdue. Card names wrap, payment labels say Mark paid, and the advisor explanation is folded under Why this card. Calculations and explicit save steps stay the same.
- Milestones retain "Counted from N bills + ₹X not billed yet".
- Spend toward a milestone = logged monthly bills in the period + unbilled spend the user typed.
  Unbilled spend stops counting once a later bill is logged.
- Card features can be read from a PDF or a description by AI, but every fact is shown for the user
  to confirm before it's saved.

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
