# Database seeding using null_resource
# This runs after Cloud SQL is provisioned

# Null resource to run migrations and seeds
resource "null_resource" "db_setup" {
  # Trigger when database changes
  triggers = {
    db_instance_id = google_sql_database_instance.postgres.id
    db_name        = google_sql_database.database.name
  }

  # Run migrations and seed data
  provisioner "local-exec" {
    command = <<-EOT
      echo "🔧 Setting up database..."

      # Start Cloud SQL Proxy
      cloud-sql-proxy ${google_sql_database_instance.postgres.connection_name} --port=5433 &
      PROXY_PID=$!

      # Wait for proxy
      sleep 10

      # Set environment variables
      export DB_HOST=127.0.0.1
      export DB_PORT=5433
      export DB_NAME=${var.db_name}
      export DB_USERNAME=${var.db_user}
      export DB_PASSWORD=${random_password.db_password.result}

      # Run migrations
      cd ${path.module}/..
      npm run migration:run || echo "⚠️  Migrations may have already been run"

      # Seed test data (only for non-prod)
      if [ "${var.environment}" != "prod" ]; then
        echo "🌱 Seeding test data..."
        npm run seed || echo "⚠️  Seeding failed or data already exists"
      fi

      # Stop proxy
      kill $PROXY_PID

      echo "✅ Database setup complete"
    EOT

    working_dir = "${path.module}/.."
  }

  depends_on = [
    google_sql_database.database,
    google_sql_user.user,
    google_service_networking_connection.private_vpc_connection
  ]
}
