# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 16 Nov 2026.

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
  balances go down on schedule, nothing to tick.
- **Assets** (`/assets`, was Portfolio): net worth today (holdings minus loans) linking to `/assets/net-worth` (three
  charts, own by asset type, owe by loan), allocation by asset type or instrument, holdings with
  search and sort, portfolio review (hidden for now, commented out in `app/(app)/assets/page.tsx`), CAS import with review, withdrawal check and insights.
- **Cards** (`/cards`): statements logged for milestones only, never as money owed, milestones,
  which card to use. All milestone progress is visible without expanding; cards with every milestone reached sort below the rest and return when their period resets. Liabilities was removed on 17 Nov 2026; old URLs redirect (`next.config.ts`).
- **Ask**: private Q&A (codes only to AI), amount questions split by the app's own planner.
- **Settings**: look, invites (admin), Ask on/off, Help and guides (Help page, What's new archive,
  Take the tour, show guides again), account and delete.
- **App shell**: bottom bar (Goals, Budget, +, Assets, Cards), Ask and Settings in the header, Back to the exact previous screen,
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
