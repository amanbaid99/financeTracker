# Status

What's live, what's open and the known gaps. Update this at the end of every task.
Last updated: 12 Nov 2026.

## Live (deployed from `claude/cool-davinci-9zjka6` to Vercel, region bom1)

- **Goals** (start page): summary card, one Next step card when there's something to do,
  goals grouped by when they're due with Must have / Nice to have, the goal calculator ("Not
  sure? Work it out", AI cost estimates), budget (plan only), and the money plan on its own page
  (`/goals/plan`) with where it goes and why, plus the This month SIP checklist. "I have extra
  money" from +.
- **Portfolio**: net worth today (holdings minus loans) linking to `/portfolio/net-worth` (three
  charts, own by asset type, owe by loan), allocation by asset type or instrument, holdings with
  search and sort, portfolio review, CAS import with review, withdrawal check and insights.
- **Credit**: cards (statements logged for milestones only, never as money owed), milestones,
  which card to use, then loans with next EMI, Mark paid from the 1st of the due month, progress.
- **Ask**: private Q&A (codes only to AI), amount questions split by the app's own planner.
- **Settings**: look, invites (admin), Ask on/off, Help and guides (Help page, What's new archive,
  Take the tour, show guides again), account and delete.
- **App shell**: bottom bar (Goals, Portfolio, +, Credit, Ask), Back to the exact previous screen,
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
