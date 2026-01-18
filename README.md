# SkiMate Backend

Real-time ski tracking and social platform backend built with NestJS, PostgreSQL/PostGIS, and Redis.

## Overview

SkiMate is an ultra-fast, real-time social fitness platform for skiers. The backend handles:

- **Live Location Tracking** - GPS ping ingestion with friend proximity alerts
- **Real-time Messaging** - WebSocket-based chat with typing indicators
- **Ski Session Management** - Track runs, vertical, speed, and distance
- **Resort Integration** - Weather data, lift status, and trail conditions
- **Strava Integration** - Import ski activities via webhooks

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS with Fastify adapter |
| Database | PostgreSQL with PostGIS extension |
| Cache | Redis (Memorystore) |
| Real-time | Socket.io with Redis adapter |
| Auth | Firebase Authentication |
| Queue | BullMQ for background jobs |
| Deployment | Google Cloud Run |
| IaC | Terraform |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with PostGIS
- Redis 7+
- Firebase project

### Installation

```bash
# Clone the repository
git clone https://github.com/ski-mate/skimate-backend.git
cd skimate-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

### Environment Variables

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=skimate
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase
FIREBASE_PROJECT_ID=skimate-307c2

# Third-party APIs
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_secret
WEATHER_UNLOCKED_APP_ID=your_app_id
WEATHER_UNLOCKED_KEY=your_key
```

### Running the Server

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert
```

## API Documentation

Complete API documentation for frontend developers. Documentation is hosted at:

**https://skimate-api-dev-uge4k3ygea-uc.a.run.app/docs**

| Page | URL | Description |
|------|-----|-------------|
| AsyncAPI Spec | `/docs` | Interactive WebSocket API specification |
| API Guide | `/docs/api` | WebSocket events and React Native examples |
| Authentication | `/docs/auth` | Firebase auth flow and token management |
| Data Models | `/docs/models` | TypeScript interfaces and enums |
| YAML Download | `/docs/asyncapi.yaml` | Machine-readable specification |

### Source Files

| Document | Path |
|----------|------|
| AsyncAPI Spec | [docs/asyncapi.yaml](./docs/asyncapi.yaml) |
| API Guide | [docs/API.md](./docs/API.md) |
| Authentication | [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) |
| Data Models | [docs/MODELS.md](./docs/MODELS.md) |

### Live Endpoints

| Environment | URL |
|-------------|-----|
| Production | `https://skimate-api-dev-uge4k3ygea-uc.a.run.app` |
| Health Check | `GET /health` |
| Location WS | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/location` |
| Chat WS | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/chat` |

## Project Structure

```
src/
├── main.ts                    # Fastify adapter entry point
├── app.module.ts              # Root module
├── data-source.ts             # TypeORM data source
├── common/
│   ├── adapters/              # Redis WebSocket adapter
│   ├── decorators/            # @Public, @CurrentUser
│   ├── guards/                # FirebaseAuthGuard
│   ├── enums/                 # All enum types
│   └── redis/                 # Redis module
├── config/                    # ConfigModule with validation
├── proto/                     # Protocol Buffers for GPS
├── migrations/                # TypeORM migrations
└── modules/
    ├── auth/                  # Firebase Admin SDK
    ├── health/                # Health check endpoint
    ├── users/entities/        # User, UserPreferences, Friendship
    ├── location/              # Live tracking module
    │   ├── location.gateway.ts
    │   ├── location.service.ts
    │   └── location-ping.processor.ts
    ├── chat/                  # Messaging module
    │   ├── chat.gateway.ts
    │   ├── chat.service.ts
    │   └── group.service.ts
    └── resort/                # Resort integration
        ├── resort.service.ts
        ├── strava.controller.ts
        └── strava.service.ts
```

## WebSocket Events

### Location Namespace (`/location`)

| Event | Direction | Description |
|-------|-----------|-------------|
| `location:ping` | client → server | Send GPS coordinates |
| `session:start` | client → server | Start ski session |
| `session:end` | client → server | End ski session |
| `location:subscribe` | client → server | Subscribe to friend locations |
| `location:update` | server → client | Receive friend location |
| `location:proximity` | server → client | Proximity alert (<100m) |

### Chat Namespace (`/chat`)

| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:join` | client → server | Join chat room |
| `chat:leave` | client → server | Leave chat room |
| `chat:send` | client → server | Send message |
| `chat:typing` | bidirectional | Typing indicator |
| `chat:read` | bidirectional | Read receipt |
| `chat:history` | client → server | Get message history |
| `chat:message` | server → client | Receive message |

## Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Coverage

| Metric | Target |
|--------|--------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

## Deployment

### Google Cloud Run

The backend is deployed to Google Cloud Run with:

- Session affinity for WebSocket connections
- 3600s request timeout for long-lived connections
- Auto-scaling based on CPU utilization

```bash
# Build and deploy
./scripts/deploy.sh
```

### Terraform

Infrastructure is managed with Terraform:

```bash
cd terraform

# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### Resources Created

- Cloud SQL (PostgreSQL with PostGIS)
- Memorystore for Redis
- Cloud Run service
- Secret Manager secrets
- VPC connector
- IAM service accounts

## Performance Guidelines

### Location Tracking

- GPS pings rate-limited to 1/second per client
- Live locations stored in Redis with 5-minute TTL
- Batch persistence to PostgreSQL via BullMQ

### Chat Messaging

- Messages cached in Redis (last 50 per room)
- Write-behind persistence for durability
- Typing indicators auto-expire after 5 seconds

### Database

- PostGIS GIST indexes on all geometry columns
- Use `ST_DWithin` for proximity queries (index-accelerated)
- Monthly partitioning on `location_pings` table

## Firebase Configuration

| Setting | Value |
|---------|-------|
| Project ID | `skimate-307c2` |
| Project Number | `346673974752` |

## Contributing

1. Create a feature branch from `main`
2. Write tests for new features
3. Ensure `npm run lint` passes
4. Create a pull request

### Commit Convention

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `docs:` - Documentation changes

## License

Proprietary - All rights reserved
