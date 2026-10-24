# Tracker

A private, invite-only personal finance app that answers one question: **what should I put my next rupee toward?**

Budget, insurance, debt, emergency fund and goals all feed a rule-based priority ladder that produces a single
"Next Focus" card. Suggestions are instrument **categories** only, never named funds. See [SPEC.md](SPEC.md).

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, shadcn-style components, Recharts
- Supabase Postgres + Auth (Google and email magic link), Row Level Security on every table
- Finance rules as pure TypeScript in `lib/engine` with Vitest tests
- Optional AI explanations through OpenRouter (free models first)

## Project layout

```
app/
  (auth)/login           sign in, with privacy consent
  auth/callback          finishes sign-in, records consent
  onboarding/[step]      stepper: basics, household, income, expenses, insurance, loans, holdings, goals, risk, finish
  (app)/dashboard        Next Focus, ladder, completeness, budget, goals, reminders
  (app)/budget | goals | goals/[id] | holdings | settings
  privacy                privacy policy (public)
  consent                re-accept when the policy version changes
lib/
  engine/                pure functions, no I/O: config, budget, ladder, goals, completeness, risk
  ai/                    OpenRouter client, anonymised facts, output guard
  supabase/              clients and generated types
  actions.ts             server actions (validated with zod)
supabase/migrations/     schema, RLS policies, invite trigger
tests/engine, tests/unit Vitest
tests/integration        RLS check with two real users (local Supabase)
tests/e2e                Playwright happy path (local Supabase)
```

All thresholds and percentages live in `lib/engine/config.ts`. Users can override the main ones in Settings
(stored in `settings.config_overrides`).

## Local development

Requires Node 22 and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth and a mail catcher at http://127.0.0.1:54324
npx supabase status -o env  # copy API_URL and PUBLISHABLE_KEY into .env.local
cp .env.example .env.local  # then fill in the two Supabase values
npm run dev
```

Add yourself to the invite list (local):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into public.allowed_emails (email) values ('you@example.com');"
```

Magic-link emails show up in the local mail catcher at http://127.0.0.1:54324.

### Tests

```bash
npm test             # engine + unit tests
npm run lint
npm run typecheck
# These two need the local stack running. Keys come from `npx supabase status -o env`.
SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npm run test:rls
npm run build && SUPABASE_SECRET_KEY=... npm run test:e2e
```

## Production setup

### 1. Supabase (separate account)

1. Create a new Supabase account and project. Pick the Mumbai (`ap-south-1`) region.
2. Link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. Add invited emails in the SQL editor (lowercase):
   ```sql
   insert into public.allowed_emails (email) values ('you@example.com'), ('friend@example.com');
   ```
4. **Authentication > URL Configuration**: set Site URL to your Vercel URL and add
   `https://<your-app>.vercel.app/**` (and `http://localhost:3000/**` for local) to Redirect URLs.
5. **Authentication > Sign In / Providers > Google**: enable it with a Google OAuth client
   (Google Cloud Console > APIs & Services > Credentials > OAuth client ID, type Web). Use the callback URL that
   Supabase shows on that screen as the authorised redirect URI.
6. **Authentication > Emails**: set up custom SMTP if you expect more than a few magic links an hour (the
   built-in sender is rate limited).
7. **Project Settings > API**: copy the Project URL and the publishable key.

Free projects pause after 7 days without activity. Regular use keeps it awake.

### 2. Vercel

1. Import the GitHub repo as a new Vercel project (Hobby plan).
2. Add environment variables from `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`
   (your Vercel URL), `NEXT_PUBLIC_CONTACT_EMAIL` (shown on the privacy page), and the AI settings below.
3. Deploy.

Never put the Supabase secret key in Vercel; the app does not need it.

### 3. AI explanations with OpenRouter (optional)

AI is off unless `OPENROUTER_API_KEY` is set, and each user also has to opt in. It only explains numbers the
engine already calculated; it never calculates, never names funds, and every answer is labelled as not advice.

1. Sign up at [openrouter.ai](https://openrouter.ai) and create an API key under **Keys**. Give the key a
   **credit limit** (for example $2) so a bug can never run up a bill.
2. Pick models on the [models page](https://openrouter.ai/models):
   - Free models have ids ending in `:free`. Put two or three in `OPENROUTER_FREE_MODELS`, comma-separated. They
     are tried in order.
   - Pick one low-cost paid model for `OPENROUTER_PAID_MODEL` and set `OPENROUTER_ALLOW_PAID=true` if you want a
     fallback. The paid model is only used when every free model fails. Add a few dollars of credit for it.
3. Privacy setting: most free models only run if you allow providers that may log or train on prompts
   (**Settings > Privacy** on OpenRouter). Tracker only sends anonymised, rounded numbers, so this is low risk.
   If you turn it on, also set `OPENROUTER_FREE_ALLOW_DATA_COLLECTION=true`. Paid requests always ask OpenRouter
   to use only providers that don't store or train on data.
4. `AI_DAILY_LIMIT` caps requests per user per day (default 20).

What the AI receives (see `lib/ai/facts.ts`): step names, rounded gaps and monthly amounts, goal **types** (not
the names you typed), years to goal, planning return, categories and statuses. It never receives a name, email,
age, date of birth, city, holding names, loan nicknames or income labels. A final check blocks any request
that looks like it contains an email, PAN, phone number or one of your own typed names. Answers that mention a
named fund, AMC or bank are hidden. Only the time, model and feature of each request are logged, never the
content.

## Privacy and consent

- Login requires agreeing to the privacy policy; the acceptance is stored in `consents` with its version.
- Onboarding ends with the not-investment-advice disclaimer ("I understand"), also stored in `consents`.
- AI explanations are a separate opt-in, and turning them off is recorded too.
- Changing `PRIVACY_VERSION` in `lib/legal/index.ts` asks every user to accept the new policy.
- Settings > Delete account removes the auth user, which cascades to every row.
- No bank or card numbers are collected, and PAN is never stored.

## Disclaimer

This app is a personal planning tool, not investment advice. Suggestions are general, based on asset categories
and the information you entered. The creator is not a SEBI-registered investment adviser. Mutual fund
investments are subject to market risks; read all scheme-related documents carefully. Consult a registered
adviser before making investment decisions.
