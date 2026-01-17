# SkiMate Backend Deployment Guide

This guide covers deploying the SkiMate backend to Google Cloud Platform.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Terraform** >= 1.5.0 installed
4. **Docker** installed
5. **Node.js** 20.x installed

## Quick Start

```bash
# 1. Authenticate with GCP
gcloud auth login
gcloud auth application-default login
gcloud config set project skimate

# 2. Configure Terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your API keys

# 3. Initialize and apply Terraform
terraform init
terraform plan
terraform apply

# 4. Build and deploy the application
cd ..
chmod +x scripts/*.sh
./scripts/deploy.sh dev

# 5. Run database migrations
./scripts/run-migrations.sh dev
```

## Detailed Steps

### Step 1: GCP Project Setup

1. Create a GCP project (or use existing `skimate` project)
2. Enable billing
3. Configure gcloud:

```bash
gcloud auth login
gcloud config set project skimate
gcloud auth application-default login
```

### Step 2: Configure Terraform Variables

Copy the example file and fill in your API keys:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id     = "skimate"
region         = "us-central1"
environment    = "dev"

# API Keys (get from respective services)
weather_unlocked_app_id = "your-app-id"
weather_unlocked_key    = "your-api-key"
strava_client_id        = "your-client-id"
strava_client_secret    = "your-client-secret"
mapbox_public_token     = "pk.your-public-token"
mapbox_secret_token     = "sk.your-secret-token"
```

### Step 3: Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply (creates all GCP resources)
terraform apply

# Save outputs for reference
terraform output > ../infrastructure-outputs.txt
```

This creates:
- **VPC Network** with private subnets
- **Cloud SQL** PostgreSQL 15 instance with PostGIS
- **Memorystore** Redis 7.0 instance
- **Secret Manager** secrets for API keys
- **VPC Connector** for Cloud Run
- **Service Account** with required permissions
- **Cloud Run** service configuration

### Step 4: Enable PostGIS Extension

After Terraform creates the database, connect and enable PostGIS:

```bash
# Get the Cloud SQL connection name
INSTANCE=$(terraform output -raw cloud_sql_connection_name)

# Connect using Cloud SQL Proxy
cloud_sql_proxy -instances=${INSTANCE}=tcp:5433 &

# Connect with psql
PGPASSWORD=$(gcloud secrets versions access latest --secret="skimate-db-password-dev") \
  psql -h 127.0.0.1 -p 5433 -U skimate_app -d skimate

# In psql, run:
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

### Step 5: Run Database Migrations

```bash
cd ..  # Back to project root

# Build the application first
npm run build

# Run migrations
./scripts/run-migrations.sh dev
```

### Step 6: Build and Deploy to Cloud Run

```bash
# Deploy to dev environment
./scripts/deploy.sh dev

# Or manually:
docker build -t gcr.io/skimate/skimate-api:latest .
docker push gcr.io/skimate/skimate-api:latest

gcloud run deploy skimate-api-dev \
  --image gcr.io/skimate/skimate-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

### Step 7: Verify Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe skimate-api-dev \
  --region us-central1 --format='value(status.url)')

# Test health endpoint
curl ${SERVICE_URL}/health

# Test WebSocket connection (requires wscat)
wscat -c "${SERVICE_URL/https/wss}/location"
```

## Environment-Specific Configuration

### Development (dev)
- Cloud SQL: `db-f1-micro`
- Redis: `BASIC` tier, 1GB
- Cloud Run: 0-10 instances, 512Mi memory

### Staging
- Cloud SQL: `db-custom-1-3840`
- Redis: `BASIC` tier, 2GB
- Cloud Run: 1-20 instances, 1Gi memory

### Production (prod)
- Cloud SQL: `db-custom-2-8192` with HA
- Redis: `STANDARD_HA` tier, 4GB
- Cloud Run: 2-50 instances, 2Gi memory
- Enable deletion protection

```bash
# Deploy to production
./scripts/deploy.sh prod
```

## CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

1. Runs tests on every push
2. Builds and pushes Docker image to GCR
3. Deploys to Cloud Run
4. Performs health check

### Setup GitHub Secrets

1. Create a GCP Service Account with roles:
   - Cloud Run Admin
   - Storage Admin
   - Secret Manager Secret Accessor

2. Set up Workload Identity Federation (recommended) or use service account key

3. Add GitHub secrets:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`

## Monitoring & Logging

### Cloud Run Logs
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

### Cloud SQL Logs
```bash
gcloud logging read "resource.type=cloudsql_database" --limit=50
```

### Set up Cloud Monitoring Alerts
1. Go to Cloud Console > Monitoring > Alerting
2. Create alerts for:
   - Cloud Run 5xx errors > 1%
   - Cloud Run latency > 500ms
   - Cloud SQL CPU > 80%
   - Redis memory > 90%

## Troubleshooting

### Cloud Run not starting
1. Check logs: `gcloud run services logs read skimate-api-dev`
2. Verify VPC connector is working
3. Check database connection string

### Database connection issues
1. Verify VPC peering is active
2. Check firewall rules
3. Ensure service account has `cloudsql.client` role

### Redis connection issues
1. Verify Memorystore is in same VPC
2. Check that VPC connector routes to private ranges

### WebSocket connections dropping
1. Ensure Cloud Run timeout is set to 3600s
2. Enable session affinity
3. Client should implement reconnection logic

## Cost Optimization

### Development
- Use `db-f1-micro` for Cloud SQL (~$10/month)
- Use `BASIC` Redis tier (~$35/month)
- Set Cloud Run min instances to 0

### Production
- Consider committed use discounts
- Use Cloud CDN for static assets
- Monitor and right-size resources

## Security Checklist

- [ ] API keys stored in Secret Manager
- [ ] Database password auto-generated and stored securely
- [ ] VPC with private IP only for database
- [ ] Firebase Auth enabled for all endpoints
- [ ] CORS configured properly
- [ ] Rate limiting on WebSocket connections
- [ ] Audit logging enabled
