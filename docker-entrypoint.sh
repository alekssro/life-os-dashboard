#!/bin/sh
set -e

echo "Starting Life OS Dashboard..."

# Wait for PostgreSQL to be ready
echo "Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

until prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1 || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "Database not ready yet - retrying ($RETRY_COUNT/$MAX_RETRIES)..."
  sleep 1
done

echo "Applying Prisma schema to PostgreSQL..."
prisma db push --accept-data-loss --skip-generate

# Optionally seed database if requested
if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "Checking database seed..."
  node prisma/seed.js || echo "Seed completed or skipped"
fi

echo "Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
