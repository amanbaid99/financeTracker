# Setup

Accounts, secret names (never values) and CI. For running the app locally, see AGENTS.md.

## SIP minimum preferences

Applied 20261121142356_sip_monthly_minimums to project sbkpirchaaljlwzgntrf on 21 Nov 2026. profiles.plan_sip_minimums stores a JSON object of held investment kinds and integer monthly minimums. It defaults to an empty object; existing owner-only profile policies remain in force. The object/size constraint and RLS state were verified after applying. No holding balances or SIP records were changed.

## Ratio budget migration

Applied `supabase/migrations/20261119061828_budget_ratio_plan.sql` to project `sbkpirchaaljlwzgntrf` on 19 Nov 2026. The filename matches the recorded hosted migration version. It creates the private `budget_ratio_plans` table, owner-only policies and explicit grants. No existing finance data was updated. Local regression exercises actual PostgreSQL owner isolation and account-deletion cascade; hosted metadata and security advisors were also checked.

## Accounts

| Service | What for | Where |
| --- | --- | --- |
| GitHub | Code, CI (`.github/workflows/checks.yml`) | `amanbaid99/financeTracker` |
| Vercel | Hosting; builds every push to the working branch | Region `bom1` (Mumbai) |
| Supabase | Postgres, auth, row level security | Project ref `sbkpirchaaljlwzgntrf`, region Mumbai |
| OpenRouter | AI for Ask, card features and cost estimates (optional) | Key in Vercel only |
| Google Cloud | Google sign-in (OAuth client used by Supabase Auth) | Configured in Supabase Auth |

## Environment variables

Set in Vercel (Production and Preview) and in `.env.local` for development. `.env.example`
lists them all with comments. Names only here.

| Name | Needed | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key only, never the secret key |
| `NEXT_PUBLIC_SITE_URL` | Yes | For sign-in redirects |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Yes | Shown on the privacy page |
| `OPENROUTER_API_KEY` | No | AI is off without it |
| `OPENROUTER_FREE_MODELS`, `OPENROUTER_PAID_MODEL`, `OPENROUTER_ALLOW_PAID` | No | Model choice |
| `OPENROUTER_FREE_ALLOW_DATA_COLLECTION` | No | Leave unset unless you accept it |
| `AI_DAILY_LIMIT`, `AI_PAID_DAILY_USD`, `AI_PAID_PER_USER_DAILY` | No | Cost limits |
| `CAS_PARSER_DEV_URL` | Local only | Where `next dev` sends statement parsing |

The secret (service role) key is never used in app code. It's only for the local security
tests, as `SUPABASE_SECRET_KEY` from `npx supabase status -o env`.

## CI

`.github/workflows/checks.yml` runs on every push and pull request: `npm ci`, a Python venv with
`requirements.txt`, pytest and pypdf (test PDFs only), then lint, typecheck, unit tests and Python tests. It needs no
secrets. The RLS and end-to-end tests need Docker and a local Supabase stack, so they run locally
(`npm run test:rls`, `npm run test:e2e:local`).

## Database

Migrations live in `supabase/migrations/`. The hosted database doesn't update on deploy: apply
each new migration with the Supabase MCP `apply_migration` (with the owner's approval) or paste
its SQL in the dashboard's SQL Editor.

## Offline and caching

`public/sw.js` caches only built app files and `public/offline.html`. Pages and data are never
cached, so nothing personal sits on the device and numbers are never stale. Bump `VERSION` in
`sw.js` to clear old caches.

## Investment Radar

Archived on 18 Nov 2026: Radar is removed from the active app and no broker token is required. The following notes describe the retained implementation only. Personal-only entitlement in radar_access. Apply 20261125000000_radar_foundation.sql before release. Configure INDSTOCKS_ACCESS_TOKEN directly in Vercel Production and Preview, never in chat. INDmoney tokens expire after 24 hours; update the secret and redeploy. The adapter only reads market instruments and daily candles. No service-role key, broker credentials, TOTP seed or Telegram token is needed for this first release. See investment-radar/INTEGRATION.md for the remaining live data checks and PRD work.


## Archived stock company reports

Not required by the active app. INDIANAPI_KEY was a server-only Vercel Secret for the optional IndianAPI Free/Hobby host, https://stock.indianapi.in. Start with the provider's free starter tier; no paid plan is selected by the app. Add the key directly to Production in the finance-tracker Vercel project and redeploy. Never prefix it NEXT_PUBLIC_, paste it into chat, retrieve it from Vercel or commit it. No Production secret is required locally for fixture tests. Preview is optional and should use a separate test credential if configured.

Refresh research on a verified stock performs at most four source reads for identity and three reports, reusing successful/partial reports for 24 hours. This is not a background job. Source plan/credit failures do not trigger upgrades or purchases and do not prevent storing current market-price evidence. No schema migration is required; optional source data and provenance live in immutable JSON snapshots. Coverage, source units/basis, publication-time evidence and company identity beyond exact ticker matching still need live verification before valuation scoring.

## Local e2e in restricted environments

The runner sets SUPABASE_TELEMETRY_DISABLED=1 to avoid the CLI telemetry write in read-only homes. It verifies API_URL, PUBLISHABLE_KEY and SECRET_KEY are present before continuing, because some CLI versions return exit 0 with a JSON error. These are local stack variables; do not substitute hosted production keys. A missing local stack still requires Docker image access. An image-download Forbidden response means signed-in tests have not run.

Reference: [Supabase CLI analytics overrides](https://github.com/supabase/cli/blob/develop/apps/cli/docs/analytics.md).

## Fresh Radar migration replay

The already-recorded holding-review version sorts before Radar foundation. It now safely skips an absent table; foundation creates the same nullable column and object/size constraint. Existing databases keep their migration versions and schema. Do not rename deployed versions or require a manual out-of-order replay for a fresh setup. tests/unit/radar-migrations.test.ts exercises both paths in a disposable embedded PostgreSQL database, including actual owner-role update restrictions. This is not a substitute for the full local Supabase RLS/auth test suite.
