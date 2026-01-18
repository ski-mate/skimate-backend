# SkiMate Backend Infrastructure
# Terraform configuration for GCP resources

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state storage
  # Uncomment and configure for production
  # backend "gcs" {
  #   bucket = "skimate-terraform-state"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "services" {
  for_each = toset([
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudscheduler.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "artifactregistry.googleapis.com",
    "containerregistry.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# =============================================================================
# NETWORKING
# =============================================================================

# VPC Network for private connections
resource "google_compute_network" "vpc" {
  name                    = "skimate-vpc-${var.environment}"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.services["servicenetworking.googleapis.com"]]
}

# Subnet for Cloud Run VPC connector
resource "google_compute_subnetwork" "subnet" {
  name          = "skimate-subnet-${var.environment}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# Private IP range for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "skimate-private-ip-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

# Private VPC connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# VPC Access Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "skimate-connector-${var.environment}"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.vpc.name
  depends_on    = [google_project_service.services["vpcaccess.googleapis.com"]]
}

# =============================================================================
# CLOUD SQL (PostgreSQL with PostGIS)
# =============================================================================

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "postgres" {
  name             = "skimate-postgres-${var.environment}-${random_id.suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.services["sqladmin.googleapis.com"]
  ]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    backup_configuration {
      enabled            = var.environment == "prod"
      start_time         = "03:00"
      binary_log_enabled = false
      
      backup_retention_settings {
        retained_backups = 7
      }
    }

    maintenance_window {
      day  = 7 # Sunday
      hour = 4
    }
  }

  deletion_protection = var.environment == "prod"
}

# Database
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# Database user
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

# =============================================================================
# MEMORYSTORE (Redis)
# =============================================================================

resource "google_redis_instance" "cache" {
  name           = "skimate-redis-${var.environment}"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version = "REDIS_7_0"

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.services["redis.googleapis.com"]
  ]

  labels = {
    environment = var.environment
  }
}

# =============================================================================
# SECRET MANAGER
# =============================================================================

# Database password secret
resource "google_secret_manager_secret" "db_password" {
  secret_id = "skimate-db-password-${var.environment}"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Weather Unlocked credentials
resource "google_secret_manager_secret" "weather_unlocked_app_id" {
  secret_id = "weather-unlocked-app-id"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "weather_unlocked_app_id" {
  secret      = google_secret_manager_secret.weather_unlocked_app_id.id
  secret_data = var.weather_unlocked_app_id
}

resource "google_secret_manager_secret" "weather_unlocked_key" {
  secret_id = "weather-unlocked-key"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "weather_unlocked_key" {
  secret      = google_secret_manager_secret.weather_unlocked_key.id
  secret_data = var.weather_unlocked_key
}

# Strava credentials
resource "google_secret_manager_secret" "strava_client_id" {
  secret_id = "strava-client-id"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "strava_client_id" {
  secret      = google_secret_manager_secret.strava_client_id.id
  secret_data = var.strava_client_id
}

resource "google_secret_manager_secret" "strava_client_secret" {
  secret_id = "strava-client-secret"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "strava_client_secret" {
  secret      = google_secret_manager_secret.strava_client_secret.id
  secret_data = var.strava_client_secret
}

# Mapbox credentials
resource "google_secret_manager_secret" "mapbox_public_token" {
  secret_id = "mapbox-public-token"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "mapbox_public_token" {
  secret      = google_secret_manager_secret.mapbox_public_token.id
  secret_data = var.mapbox_public_token
}

resource "google_secret_manager_secret" "mapbox_secret_token" {
  secret_id = "mapbox-secret-token"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.services["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "mapbox_secret_token" {
  secret      = google_secret_manager_secret.mapbox_secret_token.id
  secret_data = var.mapbox_secret_token
}

# =============================================================================
# SERVICE ACCOUNT FOR CLOUD RUN
# =============================================================================

resource "google_service_account" "cloud_run" {
  account_id   = "skimate-cloudrun-${var.environment}"
  display_name = "SkiMate Cloud Run Service Account"
}

# Grant Cloud Run service account access to Secret Manager
resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Grant Cloud Run service account access to Cloud SQL
resource "google_project_iam_member" "cloud_run_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# =============================================================================
# CLOUD RUN SERVICE
# =============================================================================

resource "google_cloud_run_v2_service" "api" {
  name     = "skimate-api-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    # Session affinity for WebSocket connections
    session_affinity = true

    # Long timeout for WebSocket connections (1 hour)
    timeout = "3600s"

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "gcr.io/${var.project_id}/skimate-api:latest"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle = true
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "prod" ? "production" : "development"
      }

      # PORT is automatically set by Cloud Run

      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.firebase_project_id
      }

      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres.private_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_NAME"
        value = var.db_name
      }

      env {
        name  = "DB_USERNAME"
        value = var.db_user
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.cache.port)
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name = "STRAVA_VERIFY_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "strava-verify-token"
            version = "latest"
          }
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 3
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds = 30
      }
    }
  }

  depends_on = [
    google_project_service.services["run.googleapis.com"],
    google_sql_database_instance.postgres,
    google_redis_instance.cache
  ]
}

# Allow unauthenticated access (authentication handled by Firebase)
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# GITHUB ACTIONS - WORKLOAD IDENTITY FEDERATION
# =============================================================================

# Workload Identity Pool for GitHub Actions
resource "google_iam_workload_identity_pool" "github_pool" {
  project                   = var.project_id
  workload_identity_pool_id = "github-cicd-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions CI/CD"

  depends_on = [
    google_project_service.services["iamcredentials.googleapis.com"],
    google_project_service.services["sts.googleapis.com"]
  ]
}

# Workload Identity Provider for GitHub OIDC
resource "google_iam_workload_identity_pool_provider" "github_provider" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"
  description                        = "OIDC provider for GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.aud"        = "assertion.aud"
  }

  # Only allow tokens from the specified repository
  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Service account for GitHub Actions deployments
resource "google_service_account" "github_actions" {
  account_id   = "github-actions-deploy"
  display_name = "GitHub Actions Deployment Service Account"
  description  = "Service account used by GitHub Actions for CI/CD deployments"
}

# Allow GitHub Actions to impersonate the service account
resource "google_service_account_iam_member" "github_actions_workload_identity" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_repository}"
}

# Grant GitHub Actions service account permissions to deploy to Cloud Run
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant GitHub Actions service account permissions to push to Container Registry
resource "google_project_iam_member" "github_actions_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant GitHub Actions service account permissions to act as Cloud Run service account
resource "google_service_account_iam_member" "github_actions_act_as_cloudrun" {
  service_account_id = google_service_account.cloud_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}
