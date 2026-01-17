**location-proximity** module need to achieve the "ultra-fastness" required for the SkiApp, the following automation files to provide a strict framework for AI agents (Claude Code and Cursor) to follow. These files enforce the use of high-performance geospatial patterns specifically for mountain environments.

### 1. The Expert Skill File

**Path**: `.claude/skills/location-proximity/SKILL.md`

---

## name: location-proximity-engine description: Expert in high-frequency GPS ingestion, Redis GEO spatial indexing, and WebSocket broadcasting for live ski tracking. Use for optimizing location updates, debugging geofencing, and scaling real-time friend tracking for SkiApp. allowed-tools: Read, Grep, Glob, Bash(npm:test), Bash(redis-cli)

# SkiApp Location & Proximity Engine Skill

This skill provides comprehensive logic and best practices for the most performance-critical module of the SkiApp backend: the real-time location tracking and proximity system.

## Overview

The proximity engine handles hundreds of concurrent GPS pings per second. It must maintain accuracy within 3 meters for safety-critical features while ensuring the battery consumption on the mobile device remains below 20% per hour.

**Technology Stack:**

* **Runtime**: NestJS with Fastify.
* **Real-time**: Socket.io with Redis Pub/Sub adapter.
* **Hot Data**: Redis (GCP Memorystore) for live coordinates.
* **Cold/Persistent Data**: PostgreSQL with PostGIS for "Run History".
* **Serialization**: Protocol Buffers (Protobuf) for minimal payload size.

## Implementation Standards

### 1. High-Frequency Ingestion (WebSocket)

**Location**: `src/modules/location/location.gateway.ts`

* [ ] **Binary Only**: Use `socket.io` with the binary data format. Avoid JSON strings for GPS pings.
* [ ] **Rate Limiting**: Discard pings arriving faster than once per second to preserve server resources.


* [ ] **Validation**: Validate coordinates against the resort's bounding box to prevent "teleportation" bugs.

### 2. Spatial Indexing (Redis)

**Location**: `src/modules/location/location.service.ts`

* [ ] **GEOADD Pattern**: Use Redis `GEOADD` with a key format like `resort:{resortId}:active_users`.
* [ ] **TTL Management**: Active location keys must expire (TTL) after 5 minutes of inactivity to prevent stale "ghost" locations on the map.


* [ ] **Member ID**: Use the internal `userId` as the member name in the Geo-set.

### 3. Proximity Broadcast Logic

* [ ] **Radius Search**: Use `GEORADIUSBYMEMBER` to find friends within the user-defined radius (default 500m).
* [ ] **Pub/Sub**: Use Redis Pub/Sub to signal other backend nodes when a user in a specific resort moves, ensuring all connected friends receive the update regardless of which server they are connected to.