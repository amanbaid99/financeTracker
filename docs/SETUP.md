# Setup

Accounts, secret names (never values) and CI. For running the app locally, see AGENTS.md.

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
`requirements.txt` and pytest, then lint, typecheck, unit tests and Python tests. It needs no
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
