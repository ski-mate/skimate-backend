# SkiMate Backend - Implementation Roadmap

## Overview
Building an ultra-fast, real-time social fitness platform for skiers with NestJS, PostgreSQL/PostGIS, Redis, and deployed to GCP Cloud Run.

---

## Phase 1: Infrastructure Setup

### 1.1 Project Scaffolding
- [x] Initialize NestJS project with Fastify adapter
- [x] Configure strict TypeScript settings
- [x] Set up ESLint and Prettier
- [x] Create folder structure (common, config, modules)
- [x] Configure environment variables and validation
- [x] Set up Redis module
- [x] Set up Firebase Admin SDK

### 1.2 Terraform Infrastructure
- [ ] Create `terraform/main.tf` with provider configuration
- [ ] Cloud SQL PostgreSQL instance with PostGIS
- [ ] Memorystore Redis instance
- [ ] Cloud Run service configuration
  - [ ] Session affinity enabled
  - [ ] 3600s timeout for WebSockets
- [ ] Secret Manager secrets for API keys
- [ ] Cloud Scheduler jobs for polling
- [ ] IAM service accounts
- [ ] VPC connector for Cloud Run

### 1.3 Configuration Management
- [x] NestJS ConfigModule with validation schemas
- [x] Environment-specific configuration
- [ ] Secret Manager integration for production

---

## Phase 2: Database Schema & TypeORM

### 2.1 TypeORM Configuration
- [x] Configure TypeORM with PostgreSQL
- [x] PostGIS geography type support
- [x] Data source for migrations
- [x] Migration scripts setup

### 2.2 Entity Definitions
- [x] User entity (Firebase UID as PK)
- [x] UserPreferences entity (JSONB settings)
- [x] Friendship entity (with indexes)
- [x] Group entity (ManyToMany with users)
- [x] Message entity (with indexes for chat queries)
- [x] Resort entity (PostGIS Polygon boundary)
- [x] Trail entity (PostGIS LineString path)
- [x] Lift entity (status tracking)
- [x] SkiSession entity (session stats)
- [x] LocationPing entity (PostGIS Point, GIST index)

### 2.3 Migrations
- [x] 1737120000000-EnablePostGIS
- [x] 1737120001000-CreateEnums
- [x] 1737120002000-CreateUserTables
- [x] 1737120003000-CreateSocialTables
- [x] 1737120004000-CreateResortTables
- [x] 1737120005000-CreateTrackingTables

---

## Phase 3: Module A - Live Tracking

### 3.1 Firebase Auth Guard
- [x] Create FirebaseAuthGuard
- [x] JWT verification with Firebase Admin SDK
- [x] Public route decorator
- [x] CurrentUser decorator
- [ ] Unit tests for auth guard

### 3.2 Protocol Buffers
- [ ] Define location.proto schema
- [ ] Generate TypeScript types
- [ ] Configure Fastify binary content parser
- [ ] Protobuf serialization service

### 3.3 WebSocket Gateway
- [ ] LocationGateway with Socket.io
- [ ] Redis adapter configuration
- [ ] ThrottlingInterceptor (1 ping/second)
- [ ] Connection state tracking in Redis
- [ ] Authentication middleware for WebSocket

### 3.4 Location Service
- [ ] Redis GEOADD for live coordinates
- [ ] GEORADIUSBYMEMBER for proximity
- [ ] TTL management (5-min expiry)
- [ ] Selective broadcast to nearby friends
- [ ] Resort detection (geofencing)

### 3.5 Persistence Worker
- [ ] BullMQ queue: `location-pings`
- [ ] Batch insert processor
- [ ] Session stats aggregation
- [ ] Error handling with retries

### 3.6 Acceptance Criteria
- [ ] GPS ping ingestion < 100ms
- [ ] Proximity detection within 500m
- [ ] WebSocket survives 60s idle
- [ ] Batch persistence < 5s delay

---

## Phase 4: Module B - Messaging

### 4.1 Chat Gateway
- [ ] ChatGateway with Socket.io rooms
- [ ] Room naming: `group:{id}` or `dm:{user1}_{user2}`
- [ ] Events: message:send, message:typing, message:read
- [ ] Instant broadcast to room members

### 4.2 Redis State Management
- [ ] Typing indicators with 5s TTL
- [ ] Message cache (last 50 per chat)
- [ ] Online status tracking
- [ ] Read receipts storage

### 4.3 Write-Behind Persistence
- [ ] Redis LPUSH + LTRIM for cache
- [ ] BullMQ queue: `chat-persistence`
- [ ] Batch insert to messages table
- [ ] Retry logic with exponential backoff

### 4.4 Group Service
- [ ] Create/update/delete groups
- [ ] Add/remove members
- [ ] Group membership validation
- [ ] TypeORM relations queries

### 4.5 Midpoint Calculation
- [ ] GeometricService implementation
- [ ] @turf/center integration
- [ ] Nearest trail/facility finder
- [ ] Meet-up request handling

### 4.6 Acceptance Criteria
- [ ] Message delivery < 50ms
- [ ] Chat history load < 10ms (from Redis)
- [ ] Typing indicator broadcasts correctly
- [ ] Midpoint calculation accuracy

---

## Phase 5: Module C - Resort Integration

### 5.1 Resort Service
- [ ] CRUD for resorts
- [ ] Trail/Lift management
- [ ] GeoJSON export service
- [ ] PostGIS spatial queries

### 5.2 Weather Polling (Cloud Function)
- [ ] Cloud Function: weather-polling
- [ ] Cloud Scheduler trigger (15 min)
- [ ] Weather Unlocked API integration
- [ ] Redis caching with TTL
- [ ] Historical data persistence

### 5.3 Lift Status Updates
- [ ] Cloud Function: lift-status
- [ ] Cloud Scheduler trigger (10 min)
- [ ] Redis caching: `lift_status:{resortId}`
- [ ] TypeORM bulk updates

### 5.4 Mapbox Service
- [ ] GeoJSON conversion service
- [ ] Mapbox Tilesets API integration
- [ ] ST_Simplify for geometry optimization
- [ ] Tileset update on status change

### 5.5 Strava Webhook
- [ ] GET /webhooks/strava (challenge-response)
- [ ] POST /webhooks/strava (activity events)
- [ ] Signature verification
- [ ] SkiSession creation from activities
- [ ] Pub/Sub relay (optional)

### 5.6 Acceptance Criteria
- [ ] Weather data < 10ms read latency
- [ ] Strava webhook responds < 2s
- [ ] Mapbox tileset updates on status change
- [ ] Lift status reflects actual state

---

## Phase 6: Testing & Deployment

### 6.1 Unit Tests
- [ ] Auth guard tests
- [ ] Location service tests
- [ ] Chat service tests
- [ ] Resort service tests
- [ ] 80%+ coverage target

### 6.2 Integration Tests
- [ ] WebSocket connection tests
- [ ] PostGIS query tests
- [ ] Strava webhook handshake
- [ ] End-to-end message flow

### 6.3 Load Testing
- [ ] Artillery/k6 setup
- [ ] 1000 concurrent GPS pings
- [ ] 95th percentile < 150ms target
- [ ] WebSocket broadcast to 50 users

### 6.4 Deployment
- [ ] terraform plan validation
- [ ] terraform apply
- [ ] Run TypeORM migrations
- [ ] Deploy Cloud Functions
- [ ] Verify Strava webhook
- [ ] Production smoke tests

---

## Success Criteria Checklist

### Code Quality
- [ ] Zero TypeScript `any` types
- [ ] All DB operations via TypeORM
- [ ] ESLint passes with zero warnings
- [ ] Prettier formatting applied

### Infrastructure
- [ ] terraform plan without errors
- [ ] Secret Manager secrets configured
- [ ] Cloud Run session affinity enabled
- [ ] PostGIS extension verified

### Performance
- [ ] 95th percentile API < 50ms
- [ ] GPS ping to Redis < 100ms
- [ ] Chat history fetch < 10ms
- [ ] Spatial queries on 10K records < 100ms

### Security
- [ ] All endpoints validate Firebase JWT
- [ ] User data access properly scoped
- [ ] Rate limiting enabled
- [ ] No hardcoded credentials

---

## Notes

- Always push code after successful builds
- Use conventional commits: feat:, fix:, refactor:, test:
- Reference .claude/skills and .cursor/rules for domain logic
- Firebase Project ID: `skimate-307c2`
- GCP Project ID: `skimate`
