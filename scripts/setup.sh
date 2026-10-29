#!/usr/bin/env bash
# One-time local setup: dependencies, the Python statement reader, the local
# Supabase stack and .env.local. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/4 Node packages"
npm install --no-audit --no-fund

echo "2/4 Python statement reader (.venv-cas)"
if [ ! -x .venv-cas/bin/python ]; then
  python3 -m venv .venv-cas
fi
.venv-cas/bin/pip install -q -r requirements.txt pytest

echo "3/4 Local Supabase (needs Docker running)"
if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start it, then run this script again." >&2
  exit 1
fi
npx supabase start >/dev/null
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"

echo "4/4 .env.local"
if [ -f .env.local ]; then
  echo ".env.local exists, leaving it alone."
else
  cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CONTACT_EMAIL=
OPENROUTER_API_KEY=
CAS_PARSER_DEV_URL=http://127.0.0.1:5328
ENV
  echo "Wrote .env.local for the local stack."
fi

cat <<'DONE'

Ready. Next:
  npm run dev                                   # app at http://localhost:3000
  .venv-cas/bin/python scripts/cas_dev_server.py  # statement import, in a second terminal
Invite yourself (local):
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    -c "insert into public.allowed_emails (email) values ('you@example.com');"
Sign-in codes arrive in the local mail catcher: http://127.0.0.1:54324
DONE
