#!/usr/bin/env bash
# Run once after PostgreSQL is installed to create the skinops database.
set -e

echo "▶  Adding postgresql@16 to PATH..."
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"

echo "▶  Starting PostgreSQL service..."
brew services start postgresql@16

echo "▶  Waiting for server to be ready..."
until pg_isready -q; do sleep 1; done

echo "▶  Creating 'skinops' database (ignore error if it already exists)..."
createdb skinops 2>/dev/null || echo "   (already exists, continuing)"

echo "✅  Database ready: postgresql://postgres@localhost:5432/skinops"
