# Working on Tracker

Tracker is a private, invite-only personal finance PWA for one owner and a few friends. It tracks
goals, the investments that pay for them, credit card milestones, and suggests how to split money
across goals. Mobile first (designed at 375px), Indian rupees, IST dates.

Read this file first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code fits
together and [docs/DECISIONS.md](docs/DECISIONS.md) for product rules and why things are the way
they are. [SPEC.md](SPEC.md) is the original build spec; parts of it are superseded (see
DECISIONS).

## Rules you must follow

These come from the owner. Breaking one is a bug even if the tests pass.

1. **Never name a fund, AMC, scheme or stock that the user doesn't already hold.** Suggestions use
   categories ("a liquid fund", "an index fund"). The user's own holdings may be named by the name
   they typed or imported. This applies to code, seed data, UI copy, tests and AI prompts.
2. **Never send personal details to AI.** No names, emails, PAN, phone or card numbers, and no
   names the user typed (goals, holdings, bills). See `lib/ask/context.ts` (names become codes like
   `[G1]`), `lib/card-extract.ts` (`maskPersonal`) and `lib/statement/ai-categories.ts` (only
   public scheme names). AI never calculates; it explains or extracts, and its output is checked.
3. **Nothing is saved without the user confirming it.** Suggestions open a prefilled form; the
   user presses Save. Imports show a review step first. Don't write to the user's hosted data
   without asking them.
4. **Every suggestion is "not investment advice".** The footer disclaimer (`components/disclaimer.tsx`)
   stays on every page that suggests something.
5. **UI copy:** plain, friendly English, short sentences, no jargon, and **no em dashes** (use a
   comma, colon or full stop). Same for commit messages and docs.
6. **Money is integer rupees.** Format with `formatINR` / `formatINRCompact` from `lib/format.ts`
   (en-IN, ₹, lakhs). **Dates are `yyyy-mm-dd` strings in IST**; finance code never reads the
   clock, callers pass `today` in (`todayIST()` from `lib/dates.ts`).
7. **Row Level Security on every table.** Policies use `user_id = (select auth.uid())`; child rows
   (card milestones, bills) also check the parent belongs to the user. Add a case to
   `tests/integration/rls.test.ts` for any new table.
8. Don't open pull requests unless asked. The owner deploys from the working branch.

## Getting started

Needs Node 22, Python 3.12+, and Docker.

```bash
npm run setup     # npm install, Python venv, local Supabase, .env.local (safe to re-run)
npm run dev       # http://localhost:3000
.venv-cas/bin/python scripts/cas_dev_server.py   # statement import + PDF text, port 5328
```

Invite an email locally, then sign in with the 6-digit code from the mail catcher at
http://127.0.0.1:54324:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into public.allowed_emails (email) values ('you@example.com');"
```

## Checks before you commit

```bash
npm run check            # lint, typecheck, unit tests (Vitest), Python tests (pytest)
npm run test:e2e:local   # builds, then runs the Playwright happy path (local Supabase)
SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npm run test:rls   # keys: npx supabase status -o env
```

- The e2e test serves `npm run build` output. If you run Playwright directly, build first or you
  test stale code. `scripts/e2e.sh` does both.
- e2e starts a fake OpenRouter (`tests/e2e/fake-openrouter.mjs`, port 5329) and the statement
  reader with a fixture (port 5328). No real AI or network calls.
- e2e runs at 375px wide. New first-visit guides are closed automatically by a locator handler.
- When you change UI text that the e2e test looks for, update `tests/e2e/happy-path.spec.ts`.
- `tests/unit/real-plan.test.ts` holds an anonymised copy of a real goal list. When a plan or
  tracker change moves its numbers, check the new numbers make sense before updating them.

## Database changes

1. Add `supabase/migrations/<yyyymmddhhmmss>_<name>.sql` (timestamps continue the existing series).
   Include RLS policies for new tables.
2. `npx supabase migration up` (local), then `npm run db:types` and
   `npx prettier --write lib/supabase/database.types.ts`.
3. The hosted database does **not** update on deploy. After the code is pushed, the migration has
   to be applied to the hosted project (Supabase project ref `sbkpirchaaljlwzgntrf`, region
   Mumbai): with the Supabase MCP `apply_migration` tool if you have it and the owner agrees, or
   give the owner the SQL to run in the dashboard. Ship code that tolerates the column not existing
   yet only if you can't do this together.

## Deploying

Vercel builds every push to the working branch (region `bom1`). `api/*.py` are Python functions
(statement reader and PDF text). `requirements.txt` is what Vercel installs, so only `casparser`
and its dependencies are available there (it brings `pypdfium2`; `pypdf` is **not** available).

## Releases and guides

User-visible features get a "What's new" entry: add it to the top of `RELEASES` in
`lib/guides.ts` (date = launch date). Each tab has a first-visit guide in `GUIDES` in the same
file; update its steps when the tab's flow changes.

## Gotchas

- `requireUser()` uses `getClaims()` (local JWT check), not `getUser()`. Keep it that way for speed.
- `/home`, `/dashboard`, `/budget`, `/holdings` and other old routes redirect to `/goals`
  (`next.config.ts`), because installed PWAs remember their old start URL. Don't reuse them.
- Quick actions from the + button (`components/quick-add.tsx`) navigate with `?do=...`, or, when
  already on that page, fire a `tracker:quick-action` event. Pages listen with `useQuickAction`.
  Clear the param with `clearParam` after opening.
- Tab changes animate with React `ViewTransition`, only for the `tab` transition type. Don't add
  `key` props on layout providers: it remounts the page and loses open sheets.
- The local Supabase stack sometimes stops in cloud containers. `npx supabase start` brings it
  back; if Docker itself is down, start `dockerd` first.
- Don't `pkill -f` with a pattern that also matches your own shell command (it kills the shell).
  Use a bracket trick: `pkill -f "node tests/e2e/[f]ake-openrouter"`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
