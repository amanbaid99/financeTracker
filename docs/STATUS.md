# Status


## SIPs on Budget, set by hand, 25 Nov 2026

The owner asked for manual SIPs under Budget instead of the automatic planner. SIP rows (`sips` in the budget sheet JSON, lib/budget-sips.ts: fund/holding, label, amount, goal, locked) are edited in components/budget-sips.tsx on the Budget page and saved with the budget (no migration). When Save & invest changes, `persist` in budget-experience scales unlocked rows with `scaleSips`. "Suggest amounts" fills rows once from `suggestSipRows` (lib/sip-suggest.ts, the existing safety_deadline engine with budget essentials). `readGoals` sets `plannedMonthly` per goal from the rows; Goals shows "₹X a month from your SIPs" against the goal's monthly need. /goals/sip redirects to /goals/budget#sips; quick-add, money plan, next step, Ask and unallocated-money links point there. Removed the standalone planner, saved-plan summary, reset button and lib/budget-sip.ts. Existing confirmed hybrid plans and goal_allocations stay untouched and still drive coverage.

Verification: npm run check (859 unit tests, 40 Python) and the full e2e pass; the e2e now adds a SIP on Budget and checks Goals shows it.

## Removed Home goal-date reminder, 24 Nov 2026

Home no longer generates the Add dates to plan your goals card or includes it in the monthly task count. This removes its Review goals and Remind me tomorrow controls. Other monthly reminders and goal date fields remain unchanged. No financial calculations or stored records changed. Verification: lint, TypeScript, 876 unit tests, 40 Python tests and production build pass. Home passes no goal-planning cues to the reminder list; the empty list renders no card.

## SIP planning matches Budget and Goals, 24 Nov 2026

Checked the Budget → SIP plan → Goals chain with the owner's real data (read-only). Fixed:
- Emergency pace in the safety_deadline engine (lib/hybrid-engine.ts): with fixed costs, each month funds a third of the gap to 1 month of costs plus a sixth of the gap to 3 months (stage cap, not the fund's slower pace). Fixed costs come from the saved budget's Essentials via `budgetEssentials` (lib/budget-sip-amount.ts) on the SIP page and again in `confirmHybridPlan`, so the preview and the saved plan match. No saved budget means 0 and the fund's own pace, as before.
- After emergency: bills funds, then `PROGRESS_MINIMUM` (₹500) to every other live goal when the amount covers all of them (not loans the EMIs close), then nearest deadline first.
- goal_first vehicle split: one holding per goal, two from ₹5,000 (lib/sip-plan.ts).
- Goals page order (`orderGoals`): emergency fund, then bills funds, like the plan.
- Owner's data (with their go-ahead): Marriage dated 2029-11-24, House 2036-11-24, all plan_rank cleared. Undated goals had been getting ₹0 in the plan.
- Removed unused lib/simple-sip.ts, components/hybrid-planner.tsx, components/budget-sip-planner.tsx.
- E2E updated for owner UI changes (compact ₹4L goal card, removed View monthly plan link, new no-salary budget header). Verification: npm run check (863 unit tests) and the full e2e pass.

## Consistent budget edits and planning reset, 24 Nov 2026

Income and cost edits now use rebalanceBudgetEdit: keep the user’s chosen personal amount and calculate Save & invest as the remaining income. Dedicated personal/saving edits retain their existing behaviour. Negative room stays visible as overspending rather than negative saving. The shared Budget/SIP available target follows the recalculated amount.

Reset Budget explicitly clears Budget and monthly SIP planning in one invoker-rights database transaction. Reset SIP plan is also available on Budget and the planner, with confirmation, while retaining Budget. An append-only reset marker hides the prior active plan, so an old profile default or saved snapshot cannot resurrect ₹71,000. Existing goal ownership, investments, actual SIP records and plan history stay unchanged. Empty planning has a clear Create SIP plan entry. Resetting the editor remounts only its amount form to clear stale local inputs; a new confirmation supersedes the reset marker. No new tables or columns.

Migration reset_monthly_planning is installed on the hosted project. The CLI migration generator failed because its telemetry writes to a read-only home path; the SQL migration was created in the existing series and tested with PGlite before installation. Hosted verification confirms SECURITY INVOKER and authenticated-only execution. No reset was executed on hosted user records for testing. Verification: lint, TypeScript, 876 unit tests, 40 Python tests and production build pass. PGlite tests exercise invoker/RLS isolation across two owners and transactional rollback; action tests check explicit confirmation and error handling. Real-component mobile tests at 320/375/768px cover income/personal/fixed edits, updated shared targets, both reset flows, cancellation and the fresh-plan entry. Full signed-in E2E remains unverified.

## Budget-linked SIP starting amount, 24 Nov 2026

Per the owner’s latest request, saved income-budget Save & invest is now the shared available amount on Budget and the SIP editor, using budgetSipAmount and the existing sheet normalization. This supersedes the earlier editor default that always restored the older standalone total. Missing/no-salary budgets retain the last manual SIP amount; explicit saved zero remains zero. The editor stays editable and confirmation remains standalone, without a Budget ceiling or any change to actual holdings, contributions or budget records.

Saved SIP goal/vehicle allocations stay immutable until confirmation. Budget shows the live available amount, the confirmed allocated amount and the exact remaining or over-budget difference, with Review plan. This avoids passing off unconfirmed money as already allocated. Opening Review starts with the updated Save & invest amount while preserving start month and existing choices. No new schema or hosted writes on page load. Verification: lint, TypeScript, 867 unit tests, 40 Python tests and production build pass. Tests cover shared targets, rule-row double-counting, explicit zero, manual fallback, read failures and both remaining/over-budget amounts. Mobile checks at 320/375/768px verify the exact ₹91,985/₹71,000/₹20,985 case, editable planning and the confirmed target. Full signed-in E2E remains unverified; no hosted financial records changed for testing.

## Clear monthly SIP allocation cards, 24 Nov 2026

Replaced corpus projections and percentages on SIP cards with monthly allocation bars from ₹0 to calculated requiredMonthly. The allocated amount appears once above the bar; colour compares monthly allocated versus required, not future corpus. Removed duplicate header totals, per-row ownership labels, goal/vehicle suggestion buttons and reset CTAs. Bills use Scheduled payments rather than No target date. Amount inputs, priority ordering, start month, confirmation and saved snapshots remain.

A held-vehicle edit now checks for another suitable unpinned linked vehicle before retaining the goal total. If none exists, lowering that vehicle lowers the goal total, so automatic fallback cannot introduce another holding just to fill the previous total. Other suitable linked vehicles can still absorb within-goal changes. Existing saved snapshots are not rewritten. No holdings, actual contributions or Budget changes. Verification: lint, TypeScript, 861 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px verify monthly percentage, no duplicate labels/buttons/totals, sole-vehicle edits, save/reopen and no overflow. No hosted financial data changed for tests.

## SIP start month and review reminder, 24 Nov 2026

Added Start contributions from to the standalone SIP planner. The month is validated, sent to confirmation, recomputed server-side and stored in the existing immutable plan inputs. Reopening restores it. Engine hybrid-1.5.0 keeps valuation/inflation/goal deadlines on today’s horizon and reduces only future monthly contribution periods; it retains the existing full-month convention, so January skips December’s normal period when planning on 24 November. Existing corpus and one-time growth are not delayed. Bill cash-flow checks exclude deferred contributions and expose pre-start cash gaps. No feasible contribution periods produces an underfunded outcome with an immediate-gap warning, rather than inventing investments.

Budget shows the start month beside the unchanged saved snapshot. A calendar-month review prompt appears after the save month, no earlier than the chosen start month. It links to the existing editor; no recalculation, auto-save, provider change or balance increase occurs from the reminder. Old plans without a month retain previous calculations. No schema changes, actual transactions or hosted records changed. Verification: lint, TypeScript, 860 unit tests, 40 Python tests and production build pass. New cases cover deferred requirements, unchanged inflation/existing growth, no feasible periods, pre-start bill cash gaps, invalid months, reminder timing and immutable snapshots. Real-component browser checks at 320/375/768px verify start-month save/reopen, no early reminder, review links, unchanged saved totals and no overflow. Full signed-in E2E remains unverified.

## Removed goal completion option, 23 Nov 2026

Removed the Goal completed, stop planning new contributions checkbox from GoalForm. Delete goal remains the way to remove an unwanted goal. Existing completion values and historical plans are preserved; no hosted goals or investment balances changed. Verification: lint, TypeScript, 853 unit tests, 40 Python tests and production build pass.

## Saved SIP summary on Budget, 23 Nov 2026

SIP confirmation now redirects to /goals/budget. Budget loads the owner’s latest confirmed safety_deadline snapshot and shows its allocated monthly total, priority-ordered goals and per-vehicle amounts with Edit plan. No new recommendation is calculated and nothing is written on page load. Zero plans remain editable; read errors are visible without blocking Budget. Budget and SIP fetching start independently. The existing budget summary has tighter spacing and a no-salary grid without the unused percentage gap; fixed costs have tighter rows without duplicate EMI labels. SIP planning stays independent of Budget and all actual balances/contributions remain unchanged. No schema changes. Verification: lint, TypeScript, 853 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px cover salary/no-salary layouts, confirmed plan rendering, Budget edits, no overflow and the SIP save destination. Full signed-in E2E remains unverified; no hosted financial data changed for tests.

## Reallocate within SIP goals first, 23 Nov 2026

Held-vehicle edits retain the current goal total and use its unpinned automatic capacity first. Only when the sum of explicit vehicle choices exceeds that total does the goal grow and use lower-priority automatic goal capacity. Decreasing a vehicle also leaves room for automatic redistribution inside the same goal. Previous explicit vehicle choices remain exact. Class-only rows still directly edit the goal amount. Regression verifies a ₹25,000 goal becomes ₹24,000 automatic plus ₹1,000 chosen while Travel remains funded. No actual contributions, holdings or Budget changes. Verification: lint, TypeScript, 851 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px verify within-goal redistribution, unchanged other goal totals and save/reopen.

## SIP priority waterfall edits, 23 Nov 2026

Reused the existing emergency-first, then nearest-deadline sequential allocator. Each goal is capped at its monthly requirement before funding the next. Vehicle edits now release previous whole-goal totals while retaining explicit vehicle choices as floors. This prevents stale derived totals from shielding lower-priority automatic allocations. Only the currently edited goal total is exact; remaining automatic capacity fills in priority order. Saved explicit vehicle amounts remain choices, not actual contributions. No Budget, holding, goal or transaction changes. Regression fixture verifies a ₹71,000 plan fills emergency, upcoming payment and Travel before Marriage; a ₹5,000 later edit comes from Marriage, and a larger edit exhausts Marriage before reducing Travel. Retrieval order does not change the result. Verification: lint, TypeScript, 849 unit tests, 40 Python tests and production build pass. Mobile real-component checks at 320/375/768px cover editable vehicles, derived totals, zero entry, saving/reopening and no overflow. No hosted financial data changed for testing.

## Removed SIP Plan details, 23 Nov 2026

Removed the entire Plan details disclosure from every goal in the monthly SIP planner, including its breakdown, assumptions and explanatory paragraphs. Goal totals, coverage colours, vehicle amount inputs and saving remain unchanged. No financial calculations or stored records changed. Verification: lint, TypeScript, 847 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px confirm the section and breakdown are absent.

## SIP totals are read-only; estimate option removed, 23 Nov 2026

Removed the emergency-cover disclosure, cost input and prior-value restoration from the active SIP page. Confirmation uses zero monthlyEssentials for standalone SIP plans, so hidden old estimate values cannot affect new plans. Emergency priority uses the goal's existing monthly requirement. Historical snapshots remain unchanged.

Goal headers now show a read-only monthly total. Only vehicles have editable amount boxes, and vehicle edits still update the total and remaining goals. Goal-level restore actions remain available. The top monthly SIP amount stays editable and independent of Budget. The shared MoneyInput now keeps a local focused draft, so clearing a value remains blank while editing even when its parent normalises empty input to zero. Focusing zero selects it for replacement, typing keeps Indian grouping, and blur restores the controlled value. Focus alone does not change stored values. SIP editing now defers projections behind immediate text updates and reuses unchanged baseline recommendations. Vehicle selection reuses one prepared money plan rather than rebuilding full projections per goal. Live previews skip unused deadline-extension searches; server confirmation still calculates complete results. Save is disabled while calculations are catching up, and live displayed projections match full calculations in regression tests. No holding, transaction or budget changes.

Verification: lint, TypeScript, 847 unit tests, 40 Python tests and production build pass. Real-component browser checks at 320/375/768px cover zero clearing, typing and blur, read-only goal totals, removed estimate controls, save/reopen and overflow. With a large retirement target and 4x CPU throttling, input-to-frame samples were 30–54 ms. No hosted financial records changed; full signed-in E2E remains unverified.

## Goal and vehicle SIP worksheet, 23 Nov 2026

The standalone SIP screen now leads with a large editable monthly total. Each priority-ordered goal has its own total, projected coverage colour/bar and every linked monthly vehicle, including zero suggestions. Existing suitability sorting is extracted as goalFirstCandidates and reused. Goal edits resplit that goal's vehicles; vehicle edits adjust the parent goal total and redistribute the remaining capacity across unfixed goals. Dotted restore links release individual choices, while Reset amounts clears all choices. Invalid/over-budget edits remain visible and cannot be saved; their projections are neutral until corrected.

sipWorksheet composes existing funding and vehicle calculations with goal-scoped exact vehicle choices, without changing current corpus ownership or balances. Shared holdings aggregate once in the saved vehicle list with separate goal parts. Explicit goal overrides may exceed calculated need within the entered total; automatic recommendations remain capped. The existing atomic action validates/recomputes scoped choices from owner data and persists vehicleOverrides in immutable plan input JSON, plus derived vehicles in results. Reopening restores zero and positive choices. No schema changes, Budget dependency, provider actions or transaction updates. Engine version is hybrid-1.4.0. Verification: lint, TypeScript, 845 unit tests, 40 Python tests and production build pass. New regressions cover exact/zero vehicle choices, goal and total invariants, shared holdings, deterministic order, explicit overfunding, completed-goal protection, foreign/stale choices and server recomputation/persistence. Real-component browser checks at 320/375/768px verify large input sizing, all vehicles, vehicle-to-goal and remaining-goal recalculation, red/green projections, dotted restores, zero save/reopen and overcommit errors without overflow. No hosted financial records were changed for testing; full signed-in E2E remains unverified.

## Standalone SIP planning, 23 Nov 2026

The active goal-first SIP workflow is independent of Budget. The route loads goals and confirmed planning inputs only. The client uses the entered monthly amount as capacity; no budget default, ceiling, warning or edit link remains. Confirmation skips loadBudget for safety_deadline plans and records budgetSource standalone, declared capacity and null budget metadata. Existing non-SIP hybrid workflows retain their previous budget validation. loadMoneyPlan preserves standalone capacity after reopening even if the saved budget has zero or lower surplus. No budget, income, holding or actual contribution records are overwritten.

Monthly essential costs are optional and independent inputs. If present, the one- and three-month safety stages apply; if omitted, the emergency goal’s existing monthly requirement is funded before dated goals. No expense amount or runway estimate is invented. Historical plans remain immutable, and goal overrides still cannot exceed the chosen total or required contribution. Verification: lint, TypeScript, 832 unit tests, 40 Python tests and production build pass. Tests cover saving ₹71,000 while Budget cannot be read, preserving standalone capacity below a saved budget ceiling, and route reopening without a Budget query. Browser checks at 320/375/768px verify ₹71,000 planning/save/reopen with blank optional costs, no budget warnings or edit link, and existing safety/allocation/override flows. No hosted financial records changed for testing.

## Holdings assumed withdrawable, 23 Nov 2026

At the owner's request, ASSUME_HOLDINGS_WITHDRAWABLE enables one explicit planning assumption across coverage, emergency runway, unassigned money, mapping candidates, SIP access checks and withdrawal previews. Historical availability/access metadata is retained but no longer blocks use of a holding. ELSS existing value can cover a linked wedding goal without entering an unlock date. Removed Access and valuation details from InvestmentSheet; saved valuation metadata remains intact. Risk-based future contribution classes, goal ownership limits and reserve protection remain separate. Preview copy states the availability assumption, without claiming a provider has confirmed redemption. No trades, balance updates, unlock claims or schema changes. Verification: lint, TypeScript, 828 unit tests, 40 Python tests and production build pass. Regression cases verify ELSS coverage for a 2028 wedding, withdrawal preview eligibility, unassigned-share accounting and unchanged input holdings. Real-component browser checks verify removed controls, saving ELSS to its parent goal, and new/existing/edit link flows at 320/375/768px. No hosted financial records changed for testing.

## Aligned Budget allocation rows, 23 Nov 2026

Replaced the cramped three-column allocation tiles with three compact rows. Labels, amounts, percentages and edit icons have consistent columns; percentages no longer repeat or wrap “of income”, and icons have their own space. Income editing, fixed-cost editing and allocation calculations are unchanged. Verification: lint, TypeScript, 825 unit tests, 40 Python tests and production build pass. Mobile checks using the screenshot values at 320/375/430/768px verify aligned amount edges, non-overlapping percentages/edit icons and no horizontal overflow; existing Budget edits and no-salary checks pass.

## Quieter Home debt and net-worth cards, 23 Nov 2026

Home debt now shows only estimated percentage repaid, its progress bar and payoff timing, with View loans retained. Removed remaining-balance figures, EMI totals and explanatory paragraphs. Missing principal/payoff data produces concise unavailable states rather than invented progress. Net worth keeps its current positive/zero styling and uses a light red background when negative. Removed the Unassigned stat from the Home card and reduced it to two asset/liability columns. Goal expansion now shows linked investments, edit/delete controls and up to three scheduled payments, without forecasts, gap analysis, funding suggestions or a Show details layer. Cards show percentage saved instead of monthly-shortfall hints. Planning stays in the SIP planner, with optional Plan details showing monthly needs, coverage, gap, projections and assumptions under each goal. Budget now has a compact three-part summary, direct income/personal/saving edits, visible fixed-cost rows and Add cost without nested View and edit menus. Personal edits reuse personalBudget and existing rule normalization; named costs remain protected and no-salary budgets retain their existing flow. No debt calculations, recorded balances or investment mapping changed. Verification: full lint, TypeScript, 825 unit tests, 40 Python tests and production build pass. Mobile real-component checks at 320/375/768px cover negative/positive/zero net-worth colours, two summary values, compact debt and missing-principal states, simplified goal details, direct personal/save/fixed edits, adding a cost and no-salary budgets. SIP save/reopen and allocation checks also pass. No hosted financial records changed for testing; full signed-in E2E remains unverified.

## Removed goal Planning preferences panel, 23 Nov 2026

Removed the priority, funding category, minimum monthly contribution and return-assumption controls from GoalForm. The emergency-first/deadline SIP planner does not need those manual allocation preferences. Existing stored values remain in form state and save payloads; new goals keep existing defaults. Completion remains directly accessible when editing a goal. The existing inflation toggle now selects today/future target basis, and future-value goals initialize it off to avoid double inflation. No target, holding or historical plan is migrated or reset. Verification: lint, TypeScript, 825 unit tests, 40 Python tests and production build pass. Real-component browser checks at 320/375/768px verify the removed controls, direct completion, future-target inflation behavior and preservation of existing priority, minimum and return settings in save payloads. No hosted financial records were changed for tests.

## Removed plan and essential-order pages, 23 Nov 2026

Removed the Your plan header button, Order essentials control, monthly-plan detail link, both pages and their unused order editor/action and saved-summary renderer. SIP planning stays in +. Saving now confirms with a toast and returns to Goals; remaining legacy entry points use the SIP planner or Goals. Old /goals/plan, /goals/order and /goals/roadmap bookmarks redirect to Goals. Guides and Help no longer direct users to those pages. Historical allocation snapshots, goal ranks, holdings and actual contributions are retained; no hosted financial data is rewritten. Verification: lint, TypeScript, 825 unit tests, 40 Python tests and production build pass. Real-component mobile checks verify SIP save confirmation and return to Goals at 320/375/768px; built-server HTTP checks verify all three retired URLs redirect to Goals. Full signed-in E2E remains unverified.

## Goal-first SIP planning, 23 Nov 2026

The SIP route now uses a goal-first SimpleSipPlanner: monthly savings, essential monthly costs if no saved budget, then editable goal totals with automatic vehicle splits. Existing models, mapping, funding maths and atomic confirmation are reused. safety_deadline is an explicit versioned allocation mode: first reach one month and then three months of emergency runway from accessible recorded cash/liquid/overnight holdings, capped by user targets; then fill requirements by next bill date or goal deadline. Combined safety/bills ownership is counted once. Safety requirements can accelerate this month's reserve building. Goal edits consume capacity before automatic allocation and show a warning. Recalculate after confirmed emergency balance updates rather than assuming planned SIPs happened.

Suitable linked vehicles split each goal amount using as many ₹1,000 minimum slots as fit; smaller amounts remain in one vehicle and integer remainders are deterministic. Safety and lifestyle pools stay separate. Existing products are preferred; broad classes are used when none suits. Only the monthly SIP workflow uses this mode; older hybrid workflows and historical plan snapshots remain readable. Confirmation rechecks costs/capacity from the saved budget, or requires explicit manual essential costs, and stores mode, costs, overrides and vehicle/goal breakdown in existing immutable plan JSON. No schema changes or actual contribution/holding updates. Legacy holding minimums are not silently carried into the new goal-first recommendation; only Save confirms the replacement. Verification: full lint, TypeScript, 826 unit tests and 40 Python tests pass; production build passes. Real-component browser checks at 320/375/768px cover safety stages, dated allocation, five-vehicle splitting, manual edits/errors, save payloads, reopen, missing manual costs and selected-plan versus available-budget totals. No hosted financial records were changed for testing. Full signed-in E2E remains unverified.

## Goal display follows upcoming deadlines, 23 Nov 2026

Old plan ranks on flexible goals hid newer, nearer goals below distant goals. orderGoals now keeps essentials first, respects their saved order, and sorts flexible goals by deadline with deterministic ID ties. Covered goals remain at the bottom; unplaced loans already covered by EMIs remain after other active goals. Home uses the same focus order. The control is labelled Order essentials to match the existing essential-only editor. Legacy planOrder and all financial allocation calculations remain unchanged. No hosted goal ranks or saved plans are rewritten. Verification: lint, TypeScript, 804 unit tests, 40 Python tests and production build pass. Regression cases cover stale flexible ranks, essential order, equal deadlines, covered goals and matching Home focus.

## Investments added inside a goal stay linked, 23 Nov 2026

GoalInvestments had opened InvestmentSheet with goalId null, so saving created a portfolio holding without a goal allocation. It now passes the goal ID/name, existing linked IDs and the current share when editing. New and existing holding saves reuse saveInvestment's allocation persistence and 100% ownership validation. Portfolio-only entry points and pooled plan recording are unchanged. New component-context and save-action regressions pass. Full lint, TypeScript, unit/Python checks and production build pass. Real-component browser checks at 320/375/768px verify new-holding and existing-holding goal IDs in save payloads and retention of a 35% share when editing. No hosted financial data was changed for testing. Full signed-in E2E remains unverified.

## Live SIP holding choices, 23 Nov 2026

Explicit holding edits are exact monthly choices, including zero. The remaining monthly capacity is recalculated using the existing hybrid engine and vehicle picker; edited holdings are excluded from automatic contribution destinations without removing their existing goal coverage. Confirmation stores only explicit choices with exactHoldings and the full monthly limit in immutable plan inputs. Legacy minimum-only plans retain their existing semantics. Reset clears choices; overcommitted plans cannot be saved. No holdings, provider SIPs or actual contributions are changed. Verification: full check passed (795 unit tests and 40 Python tests), with the additional coverage regression and server cases passing targeted checks. Lint, TypeScript and production build pass. Real-component browser checks at 320/375/768px cover live redistribution, exact-choice save payloads, reopen, reset and overcommit prevention without overflow or page errors. Full signed-in hosted E2E remains unverified.

## Editable SIP capacity without mandatory budget setup, 23 Nov 2026

SimpleSipPlanner now leads with an editable How much can you invest each month? field. A missing saved budget is distinct from a budget with zero surplus. Without a saved budget, users explicitly enter available monthly savings after expenses/EMIs; changing the amount refreshes suggestions and each destination stays editable. Before an amount is entered, the planner shows an input prompt rather than a wall of zero recommendations. A saved budget supplies the default and remains an enforced ceiling.

Confirmation accepts manualSavings only without a saved budget, records budgetSource/declaredMonthlySavings in the immutable plan inputs and flags that income/costs are not budget-verified. It never invents income or updates budgets/holdings. The shared capacity resolver preserves that confirmed assumption when Goals and the SIP editor reopen, so it does not collapse to zero on reload. Recorded contributions remain separate. Tests distinguish missing versus zero budgets, reject manual bypass of a known budget and exercise actual loaders on reload. No schema changes. Verification: lint, TypeScript, 789 unit tests, 40 Python tests and production build pass. Mobile checks at 320/375/768px cover a genuinely missing budget, editable blank monthly input, live suggestions after entering an amount, editable holding amounts, save payload, reopening with the declared amount and choices retained, and enforcement of a known budget ceiling. Actual loader tests verify that confirmed manual capacity does not collapse to zero on reload. No hosted plan or investment records were changed for testing; full signed-in E2E remains unverified.


## Budget setup in two screens, 23 Nov 2026

BudgetGuide now shows income, known EMIs and costs, blank optional Rent/Utilities prompts, and the personal spending amount together. Review allocation leads to the second screen with the three totals, then explicit Save. No separate income, cost-selection or personal-allocation screens and no SIP handoff. Editing a cost or income keeps the chosen personal amount. Blank prompts never become saved expenses. Existing personal totals are retained when rerunning setup; no-salary setup can record a personal amount without inventing income or contributions. Financial records change only when Save is pressed. Verification: lint, TypeScript, 784 unit tests, 40 Python tests and production build pass. Mobile browser checks at 320/375/768px confirm two screens, prefilled EMI, blank optional costs, no transport/day-to-day defaults, preserved personal choice on expense edits, review/back/save amounts and no-salary personal totals, without overflow or runtime errors. Full signed-in E2E remains unverified due to the previously documented local database download limitation.


## Stop old personal-cost imports in budget setup, 23 Nov 2026

The preset buttons had been removed, but guideCosts still pulled Transport and Day-to-day spending from old expense records. New setup now excludes those record categories, including Daily commute, while preserving expenses explicitly present in an existing budget/draft. Removed the same two suggestions from the legacy cost-entry presets. No stored expense or financial record is deleted. Personal spending stays the single user-chosen amount and Save & invest remains the remainder. Regression coverage includes the actual old-record inputs and preservation of a manually entered Transport row. Verification: lint, TypeScript, 782 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px supply old Transport and Day-to-day spending records, confirm neither is auto-added, allow a smaller personal amount, and verify the correct savings/save payload without overflow or runtime errors. No hosted expense records were deleted.


## One emergency and sinking goal, 23 Nov 2026

Supports one bills_fund goal with emergencyReserve and emergencyReserveDate in existing planning_settings. No competing goal type or new tables. Bills keep their amounts, cycles and due dates. The shared corpus is counted once; scheduled bills use only the balance above the reserve. Monthly funding builds a missing reserve by the earlier of its original deadline and 12 months, alongside bill funding. Reserve assumptions exclude projected investment returns. The existing goal editor preserves and edits both reserve fields, and saving includes the reserve in the stored target.

Withdrawal previews protect the reserve when the combined goal is selected, unless Use the emergency reserve too is explicitly selected. Home still derives emergency coverage from the combined goal, capped at the reserve target. A parameterized owner-requested maintenance script atomically keeps the sinking goal ID, groups ownership shares by holding, reassigns any bills, preserves the emergency deadline, then removes the redundant emergency goal. Immutable plan history, holding balances and provider SIPs remain unchanged. A private pre-merge backup is outside the repository. Verification: lint, TypeScript, 781 unit tests, 40 Python tests and production build pass. PostgreSQL/PGlite verifies the actual maintenance script preserves bill counts and pooled shares and refuses a foreign-owner pair. Mobile checks at 320/375/768px preserve reserve, deadline and bills on edit, and verify protected withdrawal previews plus explicit emergency access without overflow or runtime errors. The owner-scoped backend merge was applied after the compatible production release and verified: one combined goal, all five bill records and original deadline preserved, pooled investment ownership unchanged. Historical plans remain unchanged and require a one-time review to use the combined goal. The initially interrupted database call was verified not to have applied before retrying.


## SIP capacity uses the saved guided budget, 23 Nov 2026

Fixed loadBudget ignoring current standalone guided budgets, which made SIP capacity fall back to old income/expense records and show zero or incorrect savings. savedBudgetInputs reads the same versioned/legacy budget format as Budget, includes its personal spending, counts included loan rows once, respects excluded loans and no-salary plans, and excludes planned investments from expenses. The same loader feeds the SIP page and server confirmation. Read failures now surface instead of silently switching financial sources. Saved investment plans remain frozen until explicitly reconfirmed; no income records, holdings or loans are overwritten. Client calculation and connection errors now remain visible with a reload action and entered amounts retained. Regression tests cover the actual data loader and confirmation boundary with empty old income records. Verification: lint, TypeScript, 775 unit tests, 40 Python tests and production build pass. Mobile component checks at 320/375/768px show the saved guided budget capacity and nonzero suggestions, verify the save payload and retain entered amounts on simulated connection failure. Full signed-in E2E remains unverified because the local Supabase database image is unavailable. No hosted financial records were used for write tests.


## Lower-maintenance reviews and visible debt, 23 Nov 2026

Saved plan review flags now depend on source inputs, mapping or engine changes, not merely a new calendar day. Date validation when confirming an open draft is retained. Monthly card-statement generation, logging and reminders are unchanged. Loan and CAS reviews become optional three-month checks after the last known balance/import, with stable reminder keys and a next-week snooze using the existing seven-day RPC limit. Optional reviews appear below focus goals on Home and do not add to its task count.

Home adds a compact Debt repayment card with schedule-only expected balance, progress when original borrowing is known, EMI and expected payoff timing. Last recorded balances remain separate, actual balances/payment records/net worth are unchanged, missing data produces no invented payoff date, and scheduled payoff asks for lender closure confirmation. Existing loan management stays in Net worth. No schema changes. Verification: lint, TypeScript, 770 unit tests, 40 Python tests and production build pass. Mobile component checks at 320/375/768px verify estimated versus recorded debt, quarterly-review presentation, next-week snoozing and unchanged next-day card snoozing, without overflow or runtime errors. Full signed-in E2E remains unverified due to the documented local database download limitation.


## Budget without presets or planning prompts, 23 Nov 2026

Budget setup keeps income, known-cost review and the user's personal amount with Save & invest as the remainder. Removed preset cost buttons, including day-to-day spending and transport; new costs use a name and amount. Existing entered/recorded costs are preserved. The Budget entry is Create budget. Removed the SIP handoff CTA from the saved Budget view. The summary shows Fixed spending, Personal spending and Save & invest, with item editing in collapsed View and edit disclosures. SIP planning remains available elsewhere in the app. No schema or saved financial data changes. Verification: lint, TypeScript, 767 unit tests, 40 Python tests and production build pass. Real-component browser checks at 320/375/768px verify manual expense entry, personal-first calculation, all three saved totals, collapsed editing and absence of SIP links, without overflow or runtime errors. Full signed-in E2E remains unverified because of the previously documented local database download limitation.


## Personal-first budget setup, 23 Nov 2026

BudgetGuide keeps income and cost review, then asks how much to keep for Personal spending. Save & invest is the exact remainder after essentials and this amount, without rounding away user choices. Listed personal costs count within the amount, not twice; amounts below these costs or above available income cannot save. Existing SIPs are informational with a warning if the remainder is lower; no SIP is changed. No-salary cost setup is unchanged. Existing saved budgets are untouched until confirmed. Verification: lint, TypeScript, 767 unit tests, 40 Python tests and production build pass. Browser checks at 320/375/768px verify the personal input, exact remainder, overspend blocking and saved budget payload without overflow or runtime errors. Full signed-in E2E remains unverified due to the previously documented local database download limitation.


## Named unassigned money and actions, 23 Nov 2026

Net worth replaces the vague spare-money simplification hint with a separate per-holding list, derived from current ownership with decimal arithmetic. Each row shows the unassigned value/share and holding total. Assign to a goal reviews a goal, amount and rounded proportional share, then uses the existing transactional coverage save without reducing other goals. Unconfirmed calculated coverage must first be reviewed in the monthly plan. Saved manual mappings now count as confirmed ownership for withdrawal previews, even before a monthly plan exists. Restricted assets are visible but not called cash. Plan a withdrawal prefills that holding and amount; a source selector restricts the preview to the chosen holding with no silent substitution. It never trades or updates balances. No schema changes. Verification: lint, TypeScript, 765 unit tests, 40 Python tests and production build pass. Isolated browser checks at 320/375/768px pass for named holding values, goal/amount confirmation payload, targeted withdrawal links and source selection without overflow or runtime errors. Full signed-in E2E remains unverified because the local database image download is blocked, as recorded in the previous entry.


## One monthly planning flow, 23 Nov 2026

Your monthly SIPs uses hybridPlan/hybridVehicles, exactly as confirmation and goal projections do. Removed the separate step-allocation engine and automatic ₹500 per goal. Zero savings means zero new contributions. Both UI and server reject monthly totals above available savings; capacity is never inflated to fit a proposed plan. Budget is the source of available money, not URL parameters.

Goals no longer has a mapping/tidy approval inbox. Covered by remains inside each goal with an optional manual Change what covers this goal sheet. Normal planning preserves current mappings and fills free suitable ownership; no automatic refresh that trims confirmed shares. Emergency/essential vehicles remain separate from lifestyle vehicles. Removed mergeMapping's newest-choice-wins shrinking. save_goal_coverage is an authenticated invoker RPC using existing owner RLS and 100% trigger, locking the owner's profile, goals and holdings in the same order as confirmation. It edits one goal in a transaction, preserves all other goals and rolls back failure. No new tables or financial data changes on deployment. Applied migration 20261123034826_safe_goal_coverage; RPC invoker rights and denied anonymous execution verified.

Your plan is a compact read-only confirmed vehicle list with one Edit plan entry point to Your monthly SIPs. Goal math and frozen prior plans are secondary disclosures. Recommendations, confirmed plans and actual provider contributions remain separate. Existing investments and transactions are unchanged.

Verification: lint, TypeScript, 761 unit tests, 40 Python tests and production build pass. Isolated real-component browser checks at 320/375/768px verify editable amounts, over-budget prevention, zero capacity, save payload and fractional coverage edits without overflow or runtime errors. PostgreSQL/PGlite verifies atomic coverage rollback, unchanged other-goal shares, foreign-owner rejection and denied anonymous access. Full signed-in E2E could not start within the bounded attempt because local Supabase's database image download did not finish. No hosted financial records were mutated for testing.


What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 23 Nov 2026.

















## Accepting a mapping makes room, 24 Nov 2026

Accepting one goal's suggestion failed with "more than fully used" when other goals already used part of the holding. `mergeMapping` (lib/mapping-merge.ts) now replaces the accepted goals' rows and scales down other goals' shares of any holding that would go over 100%. Save, Accept and Accept all all go through `replaceMapping`, which restores the old rows if the insert fails.

## Stepped SIP split, 24 Nov 2026

`lib/step-allocation.ts` decides each goal's monthly amount for Your monthly SIPs: emergency floor (1 month of essentials within 3 months, then 3 months within 6, net of what's saved), bills funds' `monthlyNeed`, ₹500 for every other live goal when the budget stretches to all of them, then closest goals first up to each goal's pace, then the rest of the emergency fund's pace. Without a budget it shows the full need. `sipSuggestions` now uses it and `sipPlan` (pooled) to place amounts in held funds; the hybrid engine is no longer used for these suggestions. Essentials come from the saved budget's non-personal rows (or records). AI does not calculate amounts (rule 2). Note: a bill due very soon can take most of a month's budget before the ₹500 minimums.

## Suggestions on Goals, 24 Nov 2026

`components/goal-suggestions.tsx` at the top of Goals. Mapping suggestions (`mappingSuggestions` in lib/goal-suggestions.ts) compare `proposeGoalMapping(..., [], ...)` with the current links per goal; Accept/Accept all/Change save via `saveGoalMapping`/`saveAllMappings` (lib/goal-suggestion-actions.ts), replacing that goal's goal_allocations rows (the DB trigger enforces 100% per holding; on failure the old rows are restored). `readGoals` now uses saved goal_allocations when a hybrid plan exists or any rows exist. Tidy suggestions reuse `simplifyHints` with spare money computed from the saved mapping, plus equity covering money needed within a year. "Not now" snoozes a suggestion for 7 days via `snooze_update` (its maximum). The app never buys or sells.

## Bank accounts only first for money due within a year, 24 Nov 2026

Pooled picking (lib/sip-plan.ts) no longer adds or prefers a savings account for 1 to 3 year goals; a held debt, arbitrage or liquid fund comes first, with the bank account as the NEARBY last resort. Goals under a year still prefer a bank account.

## SIP plan shows where the budget goes, 24 Nov 2026

The top card on Your monthly SIPs now splits the suggested amount (budget Save & invest, capped at what goals need) into: your holdings, funds you don't hold yet, and any part not suggested anywhere (`inHoldings`, `inNewFunds`, `unplaced` from `sipSuggestions`). "Total a month" is labelled as the amounts you've set.

## SIP suggestions reuse your closest fund, 23 Nov 2026

`splitForGoal` pooled path (lib/sip-plan.ts) falls back to a `NEARBY` list per category when nothing fits exactly, so a held flexi-cap fund takes a 3 to 5 year goal's money instead of "a new balanced advantage fund". Liquid and short-debt needs never fall back to equity. A new fund is suggested only when nothing held is close.

## SIP plan as one list, 23 Nov 2026

`/goals/sip` now renders `components/simple-sip-planner.tsx`: every holding you can add monthly money to (not FDs or EPF), each with a suggested amount from `sipSuggestions` (lib/simple-sip.ts, built on hybridPlan/hybridVehicles; basis is what goals need, capped at the budget's Save & invest when it has one) and an editable amount, plus "Suggested, but you don't hold one" kinds of fund. Save writes a confirmed hybrid plan with the typed amounts as per-holding minimums and monthly = their total. `confirmHybridPlan` no longer rejects plans above the budget (monthlySavings = max(capacity, monthly)); the screen shows a note instead. HybridPlanner stays for the Your plan view.

## Home stops suggesting new funds, 23 Nov 2026

Home's This month keeps only the "Add dates to plan your goals" cue from `missingVehicleCues`; "Set up a liquid fund" style cues are left out (they ignore bank accounts and don't suit the owner with no salary). The snooze button reads "Remind me tomorrow" everywhere.

## SIP planner with nothing to invest, 23 Nov 2026

`components/hybrid-planner.tsx`: when the budget leaves ₹0 a month (no salary or a deficit), the ₹0 / ₹0 figures, deficit line, recorded SIPs line and the Monthly plan amount field are replaced by "Nothing to invest each month right now" with a link to Budget. The starting monthly amount is capped at what the budget allows, so a stale saved amount no longer shows a red error. Validation copy is plain. After Confirm plan, Your plan replaces the planner in history, so Back no longer returns to the planner.

Verification: npm run check and the full e2e pass. The e2e now reflects the hybrid design: after a plan is confirmed, new holdings and goals are covered once the plan is confirmed again.

## Budget setup fixed, 23 Nov 2026

Walked the budget flow in the browser and fixed what lost information. `components/budget-guide.tsx` is now three steps: income with "No salary right now", one costs list prefilled from every recorded cost and loan EMI (groceries and day-to-day spending included; personal-like names count as Personal spending) with one-tap common costs, then review. `recommendBudget` (lib/budget-guide.ts) rounds Save & invest down to ₹500, gives the rounding to Personal spending, and counts existing SIPs inside Save & invest. Budget sheets can be saved with `noSalary: true` and salary 0 (schema refine), meaning monthly costs only; loadBudget then reports income 0 and the costs. `components/budget-experience.tsx`: every row is tappable (edit, move between Essentials and Personal spending, remove), income and Save & invest open their own sheets, each Save writes the budget, "Use ₹X for Your plan" links to the SIP planner, options are Run setup again and Reset. Removed unused components/budget-sheet.tsx and budget-targets.tsx.

Verification: npm run check passes; the e2e budget steps pass against a fresh user. The full e2e currently stops earlier, at the hybrid plan section from d74419c (line ~370: after Confirm plan, the Goals link leads back to the SIP planner, so House isn't on screen). It fails identically without these changes.

## Hybrid goal allocation engine, 22 Nov 2026

Hybrid is the default in the existing SIP planner, Your plan, goal summaries and local Ask amount calculations. funding-math shares effective annual-to-monthly conversion and end-of-month contributions with tracker. hybrid-engine uses decimal.js-light with integer INR outputs, deterministic capped water filling, essential minimums then essential needs, flexible minimums then weighted remaining needs. Policy contains priority 3/2/1, urgency 1.5/1.25/1, return defaults, a 10% of monthly capacity At Risk threshold, 45-day stale valuation checks and a visible 12-month undated emergency build period. Missing risk uses balanced long-term defaults. User assumptions remain intact and are flagged when optimistic. Expired/current-month goals report immediate cash needs, not an invented monthly requirement. The existing bills schedule supplies dates to hybridBillsForecast; it checks first-cycle cash gaps and later month-end contributions without assuming returns. Scheduled loan EMIs reduce foreclosure targets through the existing loan model and are counted once in expenses.

hybrid-mapping reuses proportional goal_allocations. Confirmed ownership is unchanged until approval. Normal mapping preserves pinned shares; an explicit reviewed refresh can trim excess projected coverage and propose reusing the released share. Essentials first choose a suitable dedicated held vehicle; flexible goals cannot take that holding's spare share. Two-decimal percentages are validated against 100% totals. Locked/pledged/restricted assets and valuation uncertainty are visible. Units and live NAV feeds are not required; CAS/manual balances remain the valuation workflow. Undated ordinary goals do not get an invented date or automatic coverage, though explicit monthly preferences are supported.

Goal planning_settings holds target basis, priority, essential/flexible category, minimum monthly amount, contribution return and completion. holdings.planning_details holds availability, access date and valuation date, separate from updated_at. No existing amounts or assumptions are backfilled or overwritten. Goal forms and holding forms expose these under secondary preferences. Completing a goal releases its mapping; deleting already cascades mappings without deleting holdings.

allocation_plans is append-only under owner RLS. Each confirmation recomputes server-side, verifies budget and source revision, then atomically saves profile preferences, validated percentage ownership and a timestamped input/result snapshot with engine version, policy, manual overrides and vehicle recommendations. Historical results and vehicles are frozen, not recomputed under newer rules. Source revisions cover goals, holdings, budget, recurring income/expenses, loans/payments, bills and risk. New data produces a recommendation and stale-plan banner; confirmation stays explicit. Old save entry points cannot bypass history. Ask and extra-money previews do not directly modify confirmed plans. No actual contributions or balances are changed by recommendations or plan confirmation.

UI reuses existing routes and vehicle rows. Available/required savings lead; vehicle amounts remain primary. Goal calculations, manual overrides, policy, ownership and recent historical plans sit in disclosures. Essential order includes bills; flexible order uses weights. Explicit holding destination amounts and goal overrides are manual choices within the same budget; essential-minimum tradeoffs are flagged rather than silently overwriting those choices. Provider setup and actual investment updates remain separate. One-time existing-savings inputs are capped by unallocated recorded liquidity; the extra-money tool separately previews hypothetical new cash, which must be recorded before being treated as actual holdings.

Applied migrations: 20261122161904_hybrid_goal_allocation and 20261122163637_hybrid_risk_revision. Generated Supabase types refreshed. The CLI migration generator was attempted but its telemetry path was read-only, so committed filenames match hosted migration versions instead. RLS and atomic rollback/history behavior are tested using real PostgreSQL in PGlite. No hosted financial records were used for write tests.

Verification: 748 unit tests across 88 files and 40 Python tests pass, plus lint, TypeScript and production build. Focused mapping tests passed again after the final zero-target release guard. Browser component edit/save/reopen/stale-review/history flows passed at 320px, 375px (beige and black), and 768px (white), with no overflow or runtime errors. Real PostgreSQL/PGlite tests verify owner isolation, immutable snapshots, stale-input rejection and atomic rollback. Hosted read-only checks under an unrelated authenticated identity verified revision functions and empty history isolation; invoker rights and denied anonymous confirmation/history updates were checked. Full signed-in Playwright was attempted but local Supabase startup could not download its Postgres image (registry Forbidden); no hosted finance records were mutated for testing. CAS review now records a valid per-row NAV valuation date, falling back to the statement date, while preserving access metadata and explicit zero-unit redemptions.


## Remove retired category minimums, 22 Nov 2026

The owner requested removal of all Previous category minimum inputs. Only named holding inputs remain. Preference parsing and reservation calculations discard old type keys, so these amounts do not silently consume the budget. Saving writes only holding keys to the existing preference column. No change to recorded SIPs or holdings. Verification: lint, TypeScript, 712 unit tests, 40 Python tests and production build passed. Mobile component check confirms legacy rows and save payload keys are removed while named amounts remain.

## Named holding minimums and separate essentials, 22 Nov 2026

Monthly minimum inputs list every named holding rather than only types. Store owner-held `inv:<holding ID>` keys in the existing plan preference JSON. Server validation checks ownership against loaded holdings. That holding’s current SIP counts once; reserve only the shortfall before goal recommendations. Add the reservation to its provider setup instruction. No automatic financial-record edits. Legacy type minimums remain editable and count named reservations toward their totals, avoiding double reservation. Deleted holding preferences are omitted when editing.

Pooled SIP recommendations reserve suitable essential holdings first, preferring their linked vehicle. Other goals cannot reuse those holdings. Near-term lifestyle contributions prefer an available bank account, then another suitable liquid fund. Missing essential and other vehicles have separate placeholder keys, including lump-sum setup steps. Existing recorded SIPs are not silently moved. No schema migration is needed.

Verification: 711 unit tests and 40 Python tests pass. Named-holding edit, save, reload and setup-instruction component flows pass at 320, 375 and 768px without overflow or runtime errors. Lint, TypeScript and production build checked. Signed-in hosted data was not mutated for testing.

## Separate SIP purposes and quieter Home, 22 Nov 2026

Home leads with net worth, followed by status, the aggregate card logging nudge, useful actions and focus goals. The upcoming EMI card is removed. Existing preferences to omit payment lists and plan steps remain intact.

Monthly recommendations show Safety & essentials (emergency, bills, loan payoff), Lifestyle goals (other goals under five years or undated) and Long-term goals (five years or retirement). The same held vehicle can appear in multiple purposes. Display totals conserve the original contributions; provider setup remains one instruction per holding. Custom or unmapped contributions remain visible separately. Your plan shows purpose amounts beneath shared vehicles without a goal breakdown accordion.

Withdrawal previews use the selected goal before unassigned money. Other-goal permission cannot consume emergency or bill reserves unless that protected goal is explicitly selected. Additional protected-goal shortfalls are flagged. No financial records or mandates change automatically.

Verification: lint, TypeScript, 703 unit tests, 40 Python tests and production build passed. Isolated Home and SIP component browser checks passed at 320, 375 and 768px with no overflow or runtime errors. Signed-in end-to-end checks were not run because local Supabase is not running.

## Plan reuses what you hold, 22 Nov 2026

`pickFund` and `splitForGoal` (lib/sip-plan.ts) now fall back to any suitable fund or bank account that goals don't fully use (free share above 0), instead of only ones no goal touches. With automatic coverage almost every holding is partly used, so the old rule kept suggesting a new liquid fund. A new fund is named only when everything suitable is fully used.

## Home without payments or plan steps, 22 Nov 2026

The owner is between salaries and doesn't track card bills as paid or unpaid. Home no longer shows plan steps or card bill payments (and Mark paid is gone). `cardBillNudge` (lib/home.ts) shows one line from the 1st of each month, linking to Cards, until every card has a bill for last month; per-card "Log statement" reminders are left out of This month. The coming-up row counts EMIs of loans not on a card only. Your plan still lists its steps.

## Calmer Home, 22 Nov 2026

Home (`app/(app)/today/page.tsx`, `components/home-sections.tsx`) now reads: status line (green, amber or red from `homeStatus` in lib/home.ts: an overdue card bill, then a focus goal that's behind or short, else on track) with the count of things to do; This month (`thisMonth`: payments due within 10 days, update reminders and setup cues, plan steps from `planSteps`, and a card milestone only when within ₹10,000 or 30 days), rendered by `UpdatesDue` with a title and no Tomorrow button for payments and steps; the total going out in 30 days (`upcomingPayments`: unpaid card bills plus EMIs of loans not on a card); Focus goals with the emergency fund in months of essential costs and EMIs; and Your money (own, owe, spare, net worth). `home-balance.tsx` and `home-overview.tsx` are removed; `data-guide` targets `home-focus` and `net-worth` are kept.

Verification: npm run check passes. The e2e passes through the new Home step and up to Ask. Open: the Ask part of the e2e fails from b2c1e62 (withdrawal previews answer the skin treatment question directly, while the test expects a follow-up question). That test needs updating for the new Ask behaviour.

## Home setup cues and next actions, 21 Nov 2026

Home now merges missing-vehicle setup cues with card statement, loan-balance and CAS reminders under Next up. It shows three actions, keeps a setup cue visible among routine updates and offers Show more for all remaining actions. Goals needing one category share a cue; suitable owned vehicles, reached goals, EMI-completed loans and adequately funded on-track goals do not generate a new-fund prompt. Undated purchases ask for timing first. Record fund uses an allowlisted category to open the existing Net worth add form with blank amounts and no scheme name. fromPlan=false prevents the record flow from deducting one-time planning money. Closing the sheet clears the category. Tomorrow reuses existing owner-scoped snoozes. No database changes or hosted financial writes.

Verification: lint, TypeScript, 691 unit tests, 40 Python tests and production build passed. Twelve responsive fixture flows cover four widths and three themes, setup-cue visibility, Show more, tomorrow snoozing, category handoff, clearing the prefill, and the actual investment form saving only after confirmation with fromPlan=false. Suitable-held and empty states are checked separately. Local signed-in integration remains unavailable without the database image.

## Monthly minimums and fewer details, 21 Nov 2026

Removed Goal breakdown from every vehicle row, leaving the monthly amount and Covers line. SIP creation lists every held investment type with an optional minimum, default zero. Existing SIPs satisfy minimums before any additional amount is reserved; the remaining budget is recalculated by the existing goal planner. Chosen minimums persist in profiles.plan_sip_minimums and reload when editing. Create plan saves the monthly total, preserved one-time amount and minimums atomically after owner-scoped validation, without changing holdings or mandates. Custom allocations are separate from goal recommendations; their forecast benefit starts once actual contributions are recorded. Net worth shows at most three simplification hints and reviews more than two bank accounts without inferring inactivity from balances. Applied hosted migration 20261121142356_sip_monthly_minimums; verified column, object/size constraint and existing profile RLS.

Verification: lint, TypeScript, 682 unit tests, 40 Python tests and production build passed. Twelve responsive browser flows cover 320/375/768/1024 pixels and three themes, zero defaults, three ₹500 minimums, recalculated recommendations, over-budget blocking, explicit save with preserved one-time money, reload and Your plan display. A failed-save fixture retains the choices. Hosted metadata confirms the preference column, constraint and RLS. No financial records were changed; full signed-in local integration remains unavailable without the database image.

## Vehicle-first planning and withdrawal previews, 21 Nov 2026

SIP preview now groups monthly contributions by vehicle and includes existing SIPs once. The pooled strategy reuses one suitable holding per horizon, preferring recorded contributions, or uses a category placeholder; near-term money cannot silently use equity or gold. Your plan shows full vehicle amounts, covered goals and optional dated breakdowns, plus explicit setup actions and running contributions. A read-only withdrawal planner is available through + and Your plan. It uses unassigned eligible money before selected-goal money, requires opt-in for other goals, protects emergency reserves unless selected and excludes unverified locked/maturity-dependent assets. It recomputes automatic coverage after lower balances with targets unchanged, showing additional dated shortfalls. Amount-based withdrawal questions in Ask use this same deterministic calculation without a provider call; follow-up AI history codes known typed names and masks identifiers. No SQL, hosted financial writes, orders or mandates.

Verification: lint, TypeScript, 672 unit tests, 40 Python tests and production build passed. Twelve responsive browser flows cover four widths and three themes for pooled preview totals, save confirmation and preserved one-time amounts, vehicle-first monthly steps, direct withdrawal previews, goal impacts and no unsaved writes. New tests cover reserve protection, locked-asset exclusion, rupee conservation, compatible owned vehicles, avoiding double-counted SIPs, coded chat history and provider-free withdrawal answers. Full signed-in local integration is unavailable because the local database image is absent; no hosted account data was changed.

## Compact asset summary, 21 Nov 2026

Total value and the holdings count now share one line. Removed Last edited from the portfolio overview and every holding row. A recorded CAS import date remains visible; an unknown import date no longer adds placeholder text. No financial data or calculations changed.

Verification: npm run check and production build passed on the latest branch. Browser checks at 320, 375, 768 and 1024 pixels confirm a single-line header, no edit dates, working allocation tabs/search and no horizontal overflow. Full signed-in local integration was not rerun for this presentation-only change.


## Automatic goal coverage, 21 Nov 2026

Goals no longer use hand-made links. `readGoals` (lib/data.ts) tracks each goal with no links to learn what it needs, then `autoAllocate` (lib/auto-allocate.ts) splits holdings like a waterfall: emergency fund up to a third, bills funds and goals due within a year (soonest first), the rest of the emergency fund, then plan order (must haves first unless a custom order is set). Each goal draws only from pools that suit its horizon (cash-like, debt, hybrid, equity, gold, retirement accounts); goals over a year away get growth credit at the holding's return. A no-date loan payoff goal needs what closing costs today. New SIPs with no value go to the first goal they suit. Each goal carries `cover.why`, shown under "Covered by". The `goal_allocations` rows are left in the database untouched but ignored; the share field, Link buttons, Remove from goal and the import goal picker are gone. Net worth has a read-only Simplify your portfolio card (lib/simplify.ts): same-type funds, tiny holdings, money no goal needs. The This month checklist stays mounted after the last tick so Undo works. No migration.

Verification: npm run check and the e2e happy path pass (e2e numbers updated to the automatic split).

## Focused actions and editable spending, 21 Nov 2026

Implemented the owner-requested Cards, Your plan, quick-menu and Net worth cleanup. Cards keep milestones visible with optional pace details and one Log bill action; Which card to use is removed. Your plan puts the complete checklist before folded allocation details and avoids repeated budget totals. Extra money and SIP plan live in +; SIP planning can start with the saved Save & invest amount. Net worth top update/import actions are removed, loan rows open management, loan updates return to Net worth and closed loans are hidden. Budget Personal spending is editable and adjusts Save & invest; invalid totals and named-item target gaps prevent saving. Removed Rebuild with guide and salary-coverage UI; old salary URLs redirect to Budget. No database migration or hosted financial write.

Verification: lint, TypeScript, 648 unit tests, 40 Python tests and production build passed. Twelve Cards fixtures and twelve combined responsive fixtures cover four widths and three themes, statement forms, editable Personal spending, reciprocal allocation changes, named-item minimums, unsaved previews, loan management and + shortcuts. Full signed-in local integration remains blocked by the previously confirmed database-image extraction limit.

## Simpler Goals and Budget pages, 21 Nov 2026

Goals no longer repeats Home reminders or an extra Next step card beside the plan link. The existing money-plan form remains available through a single Plan monthly contributions entry when no plan exists, or Your plan when saved. Goal cards use smaller icons and shorter statuses; exact amounts/inflation move behind Show details, alongside existing management access. Focus goals contains only the first three unfinished goals, Other goals the rest, and Covered is separate at the bottom. Budget removes the filler subtitle and balanced-plan reassurance, uses Edit in the income header and a single primary SIP action. Rebuild and Reset move into Budget options. Only itemised buckets expand, eliminating accordions that repeated the same amount. The inactive salary-coverage prompt is now a quiet link; active warnings remain visible. A shared useDayRefresh hook preserves midnight/wake refresh after reminders move off Goals. No calculations or saved data are changed.

Verification: lint, TypeScript, 648 unit tests, 40 Python tests and production build passed. Twelve responsive fixtures cover four widths and three themes for both pages, covered-goal grouping, real monthly-plan form opening, detail toggles, quick budget editing, SIP links, rebuild cancellation and reset confirmation. Additional checks cover between-jobs suppression and the empty budget entry. Nested goal-action bodies are mocked in the layout fixture; existing action/finance tests cover their unchanged logic. Full signed-in local integration remains blocked by the previously confirmed database-image extraction limit.

## Simpler Home, 21 Nov 2026

Home now uses one balance card with current net worth, compact asset/debt totals, direct holdings navigation and the extra-money shortcut in its footer. Removed the repeated holdings link, standalone extra-money card, filler subtitle and asset/debt ratio bar. Focus-goal rows are shorter without changing the first-three order or between-jobs status. The closest milestone is one tappable card with amount left, progress and deadline, without duplicate navigation or repeated spend totals. Empty milestone cards are hidden; no-goal and all-covered states stay concise. Home uses a compact UpdatesDue variant while other tabs retain the existing reminder layout. No financial calculations or data writes changed.

Verification: lint, TypeScript, 648 unit tests, 40 Python tests and production build passed. Twelve responsive browser fixtures cover four widths and three themes, single holdings/extra-money navigation, three focus goals, milestone links and snoozing. Additional checks cover empty/covered states, long labels and negative net worth. Full signed-in local integration remains blocked by the previously confirmed database-image extraction limit.

## Loan foreclosure and extra-money access, 21 Nov 2026

Found a loan with an outstanding balance but no payoff goal, while Portfolio linked orphaned loans back to Goals and exposed no independent management controls. Added Manage loan in Net worth for all active loans and a folded Closed loans history. Explicit closure zeroes and confirms the balance, retaining EMI/payment history; deletion requires confirmation and blocks while a payoff goal remains linked to avoid stale legacy loan fields. Standalone budget reads drop EMI rows for closed/deleted loans without adding unapproved new ones. Goal deletion now explains that the loan remains separate. Restored I have extra money in the global + menu, added a Home action and mounted the existing preview for empty-goal pages with a useful empty state. No schema change. On the owner's foreclosure report, repaired the uniquely matched IDFC loan to a confirmed zero balance; verified its existing payment record remains.

Verification: lint, TypeScript, 648 unit tests, 40 Python tests and production build passed. Twelve responsive loan-management fixtures cover four widths and three themes, explicit closure, cancellation, closed history and permanent deletion. Additional browser checks cover linked-goal protection, failed closure, extra-money shortcuts on Home/Net worth/Goals/Cards and the no-goal preview. Production SQL verification confirms the IDFC balance is zero and the prior payment record is retained. Full local signed-in integration remains blocked by the previously confirmed database-image extraction limit.

## All monthly steps visible, 19 Nov 2026

This month now renders all visible SIP checklist steps without a two-item limit or Show all/Show fewer toggle. Ticking, the 10-second Undo window and plan details remain as before. No calculation or database changes. Verification: lint, TypeScript, real-plan regression tests and production build passed. Updated the existing end-to-end expectation to require no Show all/Show fewer controls.

## Optional budget-to-SIP planning, 19 Nov 2026

Removed the personal estimate option from guided setup and quick edits. Added Save & create SIP plan after budget calculation and Create a SIP plan on the saved overview. /goals/sip prefills a validated positive monthly amount and previews the existing goal allocation engine. The owner can reduce the amount to retain accessible savings, sees existing SIPs counted once, and explicitly saves the monthly plan through the existing owner-scoped action. Recorded SIPs above the selected amount block saving. Existing one-time planning money is preserved and included in preview. Saving a budget alone remains independent. No investment records, bank mandates, trades or SQL migrations are created.

Verification: lint, TypeScript, 642 unit tests, 40 Python tests and production build passed. Twelve responsive SIP-preview fixtures cover four widths and three themes, validated prefills, source-amount limits, recorded-SIP shortfalls, preserving existing one-time input and explicit save. Additional browser checks cover failed saves, the budget-save handoff, saved-budget links and removal of the estimate option. Full signed-in local integration remains blocked by the previously confirmed database-image extraction limit.

## Personal estimate option removed, 19 Nov 2026

Removed the Help me estimate calculator from guided setup and monthly editing at the owner's request. The optional manual Personal spending field and standard recommendation remain. No budget amounts or stored records are changed.

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

Verification: 711 unit tests and 40 Python tests pass. Named-holding edit, save, reload and setup-instruction component flows pass at 320, 375 and 768px without overflow or runtime errors. Lint, TypeScript and production build checked. Signed-in hosted data was not mutated for testing.

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
