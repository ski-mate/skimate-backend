output "cloud_run_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloud_sql_private_ip" {
  description = "Private IP address of Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "redis_host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.cache.port
}

output "vpc_connector_name" {
  description = "VPC Access Connector name"
  value       = google_vpc_access_connector.connector.name
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloud_run.email
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.database.name
}

output "database_user" {
  description = "Database user"
  value       = google_sql_user.user.name
}

# GitHub Actions Workload Identity outputs
output "github_workload_identity_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions (use as GCP_WORKLOAD_IDENTITY_PROVIDER secret)"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}

output "github_service_account_email" {
  description = "Service account email for GitHub Actions (use as GCP_SERVICE_ACCOUNT secret)"
  value       = google_service_account.github_actions.email
}
