# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 17 Nov 2026.

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
