#!/usr/bin/env bash
# Browse the PRODUCTION database in Drizzle Studio, read-only.
#
# Connects as the `zoobalo_ro` role, which holds SELECT and nothing else —
# writes are refused by PostgreSQL itself, so Studio cannot alter production
# data no matter what you click. Schema changes belong on the EC2 box:
#   ssh ... && cd ~/skincare-flow-pro/backend && npm run db:push
set -e

cd "$(dirname "$0")/.."

# DATABASE_URL_RO lives in backend/.env.local (gitignored — it holds a password).
if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

if [ -z "$DATABASE_URL_RO" ]; then
  echo "⛔  DATABASE_URL_RO is not set."
  echo "    Expected it in backend/.env.local — see backend/.env.example."
  exit 1
fi

./scripts/db-tunnel.sh

echo "▶  Starting Drizzle Studio (read-only) ..."
DATABASE_URL="$DATABASE_URL_RO" npx drizzle-kit studio
