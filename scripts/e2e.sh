#!/usr/bin/env bash
# Builds and runs the Playwright happy path against the local Supabase stack.
# Needs `npm run setup` once. Extra arguments go to Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."

npx supabase status >/dev/null 2>&1 || npx supabase start >/dev/null
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
export SUPABASE_URL=$API_URL SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY SUPABASE_SECRET_KEY=$SECRET_KEY

# The test serves the production build, so build first or it tests old code.
# /api/cas_parse must reach the local reader on port 5328.
CAS_PARSER_DEV_URL=http://127.0.0.1:5328 npm run build
npx playwright test "$@"
