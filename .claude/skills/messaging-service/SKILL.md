**messaging-service** need to support the "ultra-fastness" required for a multi-user application, these automation files provide the necessary framework for AI agents to maintain high performance while ensuring no data is lost during transit.

### 1. The Expert Skill File

**Path**: `.claude/skills/messaging-service/SKILL.md`

---

## name: messaging-service-expert
description: Expert in real-time chat, group coordination, mid-point calculation, and Strava fitness sync. Focuses on low-latency state management using Redis, reliable persistence using the write-behind pattern, and asynchronous activity processing via Pub/Sub for SkiApp.
allowed-tools: Read, Grep, Glob, Bash(npm:test), Bash(redis-cli)

# SkiApp Messaging Service Skill

This skill governs the development and review of the messaging, group coordination, and social fitness sync modules, ensuring that real-time social features do not lag even with thousands of concurrent users.

## Overview

The messaging service handles 1:1 chats, group coordination, specialized "meet-up" requests, and Strava activity synchronization. It balances the need for instant delivery (WebSockets/Redis) with the requirement for long-term historical storage (PostgreSQL) and asynchronous processing of external webhooks.

**Technology Stack:**

* **State Management**: Redis for "Typing" indicators and "Read" receipts.
* **Cache**: Redis List for the last 50 messages per conversation.
* **Persistence**: PostgreSQL for permanent chat logs.
* **Worker Queue**: BullMQ for asynchronous database writes.
* **Pub/Sub**: Google Cloud Pub/Sub for Strava webhook processing.

## Implementation Standards

### 1. Real-Time State (Redis)

**Location**: `src/modules/chat/chat.gateway.ts`

* [ ] **Typing Indicators**: Use a Redis key with a short TTL (5-10 seconds) to track typing status. Do not persist this to the database.
* [ ] **Online Status**: Track user socket connections in Redis to enable the "Friends Near Me" and online indicators.

### 2. Message Flow (Write-Behind)

**Location**: `src/modules/chat/chat.service.ts`

* [ ] **Hot Cache**: When a message is sent, immediately push it to a Redis List (`chat:msg:{conversationId}`).
* [ ] **Async Persistence**: Emit a job to BullMQ to persist the message to PostgreSQL. This prevents the database write from slowing down the WebSocket broadcast.
* [ ] **Pagination**: Load the first 50 messages from Redis for "ultra-fast" chat opening.

### 3. Social Sync & Messaging Expert

#### Strava Fitness Sync (Pub/Sub)

**Location**: `cloud-run/strava-webhook/` and `src/modules/social/strava-subscriber.service.ts`

* [ ] **Webhook Endpoint**: Create a lightweight Cloud Run endpoint specifically to receive Strava POST webhooks. It must respond with 200 OK within 2 seconds to avoid Strava retries.
* [ ] **Pub/Sub Relay**: The webhook receiver should immediately publish the raw Strava event to a Google Cloud Pub/Sub topic (`strava-activity-updates`).
* [ ] **Asynchronous Processing**: A NestJS subscriber service listens to the Pub/Sub topic to process the activity (calculating stats, updating leaderboards) without blocking the webhook response.

### 4. Coordination Logic

* [ ] **Midpoint Calculation**: Continue using the Cartesian centroid calculation for "Meet-up" requests, but ensure the final coordinate is verified against Mapbox terrain data to ensure it isn't placed on a cliff or out-of-bounds area.
* [ ] **Meet-up Requests**: Support the "Meet-up request" UI by generating a dynamic waypoint on the map for all invited friends.

---

