variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "skimate"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Database Configuration
variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro" # Use db-custom-2-4096 for production
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "skimate"
}

variable "db_user" {
  description = "Database user"
  type        = string
  default     = "skimate_app"
}

# Redis Configuration
variable "redis_tier" {
  description = "Memorystore Redis tier"
  type        = string
  default     = "BASIC" # Use STANDARD_HA for production
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

# Cloud Run Configuration
variable "cloud_run_min_instances" {
  description = "Minimum instances for Cloud Run"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum instances for Cloud Run"
  type        = number
  default     = 10
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "512Mi"
}

# Firebase Configuration
variable "firebase_project_id" {
  description = "Firebase Project ID"
  type        = string
  default     = "skimate-307c2"
}

# API Keys (stored in Secret Manager, referenced here)
variable "weather_unlocked_app_id" {
  description = "Weather Unlocked App ID"
  type        = string
  sensitive   = true
}

variable "weather_unlocked_key" {
  description = "Weather Unlocked API Key"
  type        = string
  sensitive   = true
}

variable "strava_client_id" {
  description = "Strava Client ID"
  type        = string
  sensitive   = true
}

variable "strava_client_secret" {
  description = "Strava Client Secret"
  type        = string
  sensitive   = true
}

variable "mapbox_public_token" {
  description = "Mapbox Public Token"
  type        = string
  sensitive   = true
}

variable "mapbox_secret_token" {
  description = "Mapbox Secret Token"
  type        = string
  sensitive   = true
}
