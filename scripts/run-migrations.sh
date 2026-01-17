#!/bin/bash
set -e

# SkiMate Database Migration Script
# This script runs migrations against the Cloud SQL database
# Usage: ./scripts/run-migrations.sh [environment]

ENVIRONMENT=${1:-dev}
PROJECT_ID="skimate"
REGION="us-central1"
INSTANCE_NAME="skimate-postgres-${ENVIRONMENT}"

echo "🗄️  SkiMate Database Migration"
echo "=============================="
echo "Environment: ${ENVIRONMENT}"
echo ""

# Get instance connection name
INSTANCE_CONNECTION=$(gcloud sql instances describe ${INSTANCE_NAME} --format='value(connectionName)' 2>/dev/null || echo "")

if [ -z "$INSTANCE_CONNECTION" ]; then
    echo "⚠️  Cloud SQL instance not found. Running terraform first may be required."
    echo "   For local development, ensure DB_HOST, DB_USERNAME, DB_PASSWORD are set."
    
    # Check if local env vars are set
    if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
        echo "❌ Database connection info not available."
        exit 1
    fi
fi

echo "📦 Building application..."
npm run build

echo ""
echo "🔄 Running migrations..."

if [ -n "$INSTANCE_CONNECTION" ]; then
    # Use Cloud SQL Proxy for GCP
    echo "Starting Cloud SQL Proxy..."
    
    # Check if cloud_sql_proxy is installed
    if ! command -v cloud_sql_proxy &> /dev/null; then
        echo "Installing cloud_sql_proxy..."
        curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
        chmod +x cloud_sql_proxy
    fi
    
    # Start proxy in background
    ./cloud_sql_proxy -instances=${INSTANCE_CONNECTION}=tcp:5433 &
    PROXY_PID=$!
    sleep 5
    
    # Get database password from Secret Manager
    DB_PASSWORD=$(gcloud secrets versions access latest --secret="skimate-db-password-${ENVIRONMENT}")
    
    export DB_HOST=127.0.0.1
    export DB_PORT=5433
    export DB_USERNAME=skimate_app
    export DB_PASSWORD=${DB_PASSWORD}
    export DB_NAME=skimate
    
    npm run migration:run
    
    # Clean up proxy
    kill $PROXY_PID 2>/dev/null || true
else
    # Use local connection
    npm run migration:run
fi

echo ""
echo "✅ Migrations complete!"
