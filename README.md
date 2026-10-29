# Tracker

A private, invite-only personal finance app (installable PWA) for tracking goals and the money that
pays for them. It answers: **where should my next rupee go?**

- **Goals**: purchases, trips, emergency and bills funds, loans to close early. Each goal shows
  what's saved, where it's heading and the monthly amount that gets it there on time.
- **Money plan**: splits savings and a monthly amount across goals, as SIPs in the funds you
  already hold.
- **Portfolio**: everything you hold by asset class; update values or import a CAS statement.
- **Cards**: credit card milestones, monthly bills and which card to use next.
- **Ask**: private questions about your own numbers, with names never sent to AI.

Suggestions name kinds of fund, or funds you already hold, never new ones. Not investment advice.

**Working on the code?** Start with [AGENTS.md](AGENTS.md), then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md).
[SPEC.md](SPEC.md) is the original spec, partly superseded.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS v4
- Supabase Postgres + Auth (email code and Google), Row Level Security on every table
- Python functions on Vercel for reading CAS statements and PDFs
- Finance logic as pure TypeScript in `lib/` with Vitest tests
- Optional AI through OpenRouter, free models first

## Project layout

```
app/(app)/            signed-in pages: goals, portfolio, cards, ask, import, settings
app/(auth)/login      sign in, with privacy consent
app/consent, privacy  policy re-acceptance and the public policy
components/           UI (sheets, forms, goal and card views)
lib/                  finance logic (tracker, allocate, sip-plan, bills-fund, cards, loan...),
                      data loaders (data.ts) and server actions (*actions.ts)
lib/ai/               OpenRouter settings and model router
lib/ask/              Ask: anonymised context and the server action
lib/statement/        CAS import: review rows, categories, AI category check
api/                  Python functions: cas_parse.py, pdf_text.py
supabase/migrations/  schema and RLS policies
tests/unit            Vitest      tests/integration  RLS with two real users
tests/python          pytest      tests/e2e          Playwright happy path
```

## Local development

Requires Node 22, Python 3.12+ and Docker.

```bash
npm run setup     # installs everything, starts local Supabase, writes .env.local
npm run dev       # http://localhost:3000
.venv-cas/bin/python scripts/cas_dev_server.py   # statement import, second terminal
```

Add yourself to the invite list (local):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into public.allowed_emails (email) values ('you@example.com');"
```

Sign-in codes show up in the local mail catcher at http://127.0.0.1:54324.

### Tests

```bash
npm run check            # lint, typecheck, unit and Python tests
npm run test:e2e:local   # build + Playwright against local Supabase
# RLS check. Keys come from `npx supabase status -o env`.
SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npm run test:rls
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

AI is off unless `OPENROUTER_API_KEY` is set, and each user also has to opt in. It explains numbers the app
already calculated or reads documents for you to confirm; it never calculates, never names funds, and every answer is labelled as not advice.

1. Sign up at [openrouter.ai](https://openrouter.ai) and create an API key under **Keys**. Give the key a
   **credit limit** (for example $5) so a bug can never run up a bill. Buying at least 10 credits once raises
   the free-model limit from 50 to 1,000 requests a day.
2. Set `OPENROUTER_API_KEY` in Vercel and redeploy. That's all that's required. Models are picked
   automatically (`lib/ai/router.ts`):
   - Free models come from OpenRouter's live model list, ranked by size, recency, context and JSON support.
     Checks that need agreement (fund categories, card features) use two free models from different makers.
   - A model that fails is rested for a while (a minute after a rate limit, longer after errors).
   - Paid models are used only when free ones fail, disagree, or today's free quota is nearly used. The paid
     pick is the cheap paid version of a good free model, under a price cap.
   - Paid spend is capped by `AI_PAID_DAILY_USD` (default $0.50 a day) and `AI_PAID_PER_USER_DAILY`
     (default 10 requests per person). Set `OPENROUTER_ALLOW_PAID=false` to never use paid models.
   - Optional: `OPENROUTER_FREE_MODELS` and `OPENROUTER_PAID_MODEL` name models to try first.
3. Privacy setting: most free models only run if you allow providers that may log or train on prompts
   (**Settings > Privacy** on OpenRouter). Tracker only sends anonymised, rounded numbers and masked card
   documents, so this is low risk. If you turn it on, also set `OPENROUTER_FREE_ALLOW_DATA_COLLECTION=true`.
   Otherwise free models that need it are skipped. Paid requests always ask OpenRouter to use only providers
   that don't store or train on data.
4. `AI_DAILY_LIMIT` caps requests per user per day for each feature (default 20).

What the AI receives (see `lib/ask/context.ts`): rounded amounts, goal **types**, years to goal, kinds of
investment and statuses. Names you typed (goals, holdings, bills) become codes like `[G1]` and are put back
only when the reply is shown to you. It never receives your name, email, PAN, phone, age or city. Card
documents have card numbers, emails, phones and PAN masked first (`lib/card-extract.ts`), and statement
categories send only public scheme names. The AI is told never to recommend a fund, AMC or stock. Only the
time, model and feature of each request are logged, never the content.

## Privacy and consent

- Login requires agreeing to the privacy policy; the acceptance is stored in `consents` with its version.
- The not-investment-advice disclaimer is in the footer of every signed-in page. (The one-time "I understand"
  step went away with onboarding; `DISCLAIMER_VERSION` is no longer checked.)
- AI (Ask and card reading) is a separate opt-in, and turning them off is recorded too.
- Changing `PRIVACY_VERSION` in `lib/legal/index.ts` asks every user to accept the new policy.
- Settings > Delete account removes the auth user, which cascades to every row.
- No bank or card numbers are collected, and PAN is never stored.

## Disclaimer

This app is a personal planning tool, not investment advice. Suggestions are general, based on asset categories
and the information you entered. The creator is not a SEBI-registered investment adviser. Mutual fund
investments are subject to market risks; read all scheme-related documents carefully. Consult a registered
adviser before making investment decisions.
