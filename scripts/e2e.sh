#!/usr/bin/env bash
# Builds and runs the Playwright happy path against the local Supabase stack.
# Needs `npm run setup` once. Extra arguments go to Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."

# Avoid telemetry writes in read-only agent homes and CI.
export SUPABASE_TELEMETRY_DISABLED=1
local_status="$(npx supabase status -o env 2>/dev/null)" || local_status=""
# Some CLI versions return exit 0 with a JSON error. Check the actual variables.
if ! grep -q '^API_URL=' <<<"$local_status"; then
  npx supabase start >/dev/null
  local_status="$(npx supabase status -o env 2>/dev/null)" || local_status=""
fi
for required_key in API_URL PUBLISHABLE_KEY SECRET_KEY; do
  if ! grep -q "^${required_key}=" <<<"$local_status"; then
    echo "Local Supabase is unavailable or its status output is incompatible. No tests were run." >&2
    exit 1
  fi
done
eval "$(grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=' <<<"$local_status")"
export SUPABASE_URL=$API_URL SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY SUPABASE_SECRET_KEY=$SECRET_KEY

# The test serves the production build, so build first or it tests old code.
# /api/cas_parse must reach the local reader on port 5328.
CAS_PARSER_DEV_URL=http://127.0.0.1:5328 npm run build
npx playwright test "$@"
