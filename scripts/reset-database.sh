#!/bin/bash
# Reset Database - Drop, Create, Migrate, Seed
# Usage: ./scripts/reset-database.sh

set -e

echo "🔄 Resetting SkiMate Database"
echo ""

# Check if Cloud SQL Proxy is needed
if [ "$DB_HOST" == "127.0.0.1" ] && [ "$DB_PORT" == "5433" ]; then
    echo "✓ Using Cloud SQL Proxy (localhost:5433)"
elif [ "$DB_HOST" == "localhost" ] && [ "$DB_PORT" == "5432" ]; then
    echo "✓ Using local PostgreSQL (localhost:5432)"
else
    echo "ℹ️  Custom database host: $DB_HOST:$DB_PORT"
fi

# Confirm
echo ""
echo "⚠️  WARNING: This will delete ALL data in the database!"
read -p "Are you sure you want to continue? (yes/NO): " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    echo "❌ Cancelled"
    exit 1
fi

# Get database credentials
DB_NAME=${DB_NAME:-skimate}
DB_USER=${DB_USERNAME:-skimate_app}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5433}

export PGPASSWORD=${DB_PASSWORD}

echo "🗑️  Dropping database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>&1 | grep -v "does not exist" || true

echo "📦 Creating database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

echo "🔧 Running migrations..."
npm run migration:run

echo "🌱 Seeding test data..."
npm run seed

echo ""
echo "=" | head -c 60; echo
echo "✅ DATABASE RESET COMPLETE!"
echo "=" | head -c 60; echo
echo ""
echo "Test user created:"
echo "  Email: test@skimate.dev"
echo "  Firebase UID: 47dZFPzKsnTmpNHyaN9t8lt4xk43"
echo ""
echo "Next: Test WebSocket endpoints"
echo "  node scripts/test-websockets.mjs"
echo ""
