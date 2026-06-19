#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ "${SEED_ON_START}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

exec "$@"
