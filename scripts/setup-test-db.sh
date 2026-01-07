#!/bin/bash
# Script to create test database
# Usage: ./scripts/setup-test-db.sh

set -e

echo "Creating test database..."

# Connect to PostgreSQL and create test database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE chatapp_test;" 2>/dev/null || echo "Database chatapp_test already exists or connection failed"

echo "✅ Test database created (or already exists)"
echo ""
echo "Next steps:"
echo "1. Copy .env.test.example to .env.test"
echo "2. Update DATABASE_URL in .env.test to use chatapp_test"
echo "3. Run migrations: pnpm prisma migrate deploy"

