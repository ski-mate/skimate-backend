#!/bin/bash
set -e

# SkiMate Backend Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh dev

ENVIRONMENT=${1:-dev}
PROJECT_ID="skimate"
REGION="us-central1"
SERVICE_NAME="skimate-api-${ENVIRONMENT}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/skimate-api"

echo "🎿 SkiMate Backend Deployment"
echo "=============================="
echo "Environment: ${ENVIRONMENT}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if gcloud is configured
if ! gcloud config get-value project &> /dev/null; then
    echo "❌ gcloud not configured. Run: gcloud auth login && gcloud config set project ${PROJECT_ID}"
    exit 1
fi

# Ensure we're in the right project
gcloud config set project ${PROJECT_ID}

echo "📦 Step 1: Building Docker image..."
docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${ENVIRONMENT} .

echo ""
echo "🚀 Step 2: Pushing to Google Container Registry..."
docker push ${IMAGE_NAME}:latest
docker push ${IMAGE_NAME}:${ENVIRONMENT}

echo ""
echo "☁️  Step 3: Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:latest \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=${ENVIRONMENT}" \
    --quiet

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""

# Test health endpoint
echo "🔍 Testing health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Health check passed (HTTP ${HTTP_STATUS})"
else
    echo "❌ Health check failed (HTTP ${HTTP_STATUS})"
    exit 1
fi

echo ""
echo "🎉 Deployment successful!"
echo "   API URL: ${SERVICE_URL}"
echo "   Health: ${SERVICE_URL}/health"
echo "   WebSocket (Location): ${SERVICE_URL}/location"
echo "   WebSocket (Chat): ${SERVICE_URL}/chat"
