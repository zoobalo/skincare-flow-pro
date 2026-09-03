#!/usr/bin/env bash
# Opens an SSH tunnel to the production PostgreSQL on EC2, which does not
# accept connections from the internet (5432 is firewalled). Idempotent —
# re-running while a tunnel is already up is a no-op.
#
#   local 127.0.0.1:5433  ->  ec2 localhost:5432
set -e

# Host and key are NOT hardcoded — this repo is public. Both come from
# backend/.env.local (gitignored). See .env.example.
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

PEM="${ZOOBALO_PEM:-}"
HOST="${ZOOBALO_HOST:-}"
LOCAL_PORT="${ZOOBALO_DB_PORT:-5433}"

if [ -z "$HOST" ]; then
  echo "⛔  ZOOBALO_HOST is not set (expected in backend/.env.local)."
  exit 1
fi

if [ ! -f "$PEM" ]; then
  echo "⛔  SSH key not found at '${PEM:-<unset>}'"
  echo "    Set ZOOBALO_PEM in backend/.env.local."
  exit 1
fi

if pgrep -f "${LOCAL_PORT}:localhost:5432" > /dev/null 2>&1; then
  echo "✅  Tunnel already open on 127.0.0.1:${LOCAL_PORT}"
  exit 0
fi

echo "▶  Opening tunnel 127.0.0.1:${LOCAL_PORT} -> ${HOST}:5432 ..."
ssh -i "$PEM" \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -f -N -L "${LOCAL_PORT}:localhost:5432" "ubuntu@${HOST}"

echo "✅  Tunnel open. Close it later with: npm run db:tunnel:stop"
