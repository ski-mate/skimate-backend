**Resort & Environmental Integration** module should be "ultra-fast" and resilient to 3rd-party API failures, these automation files provide the framework for caching and proxying mountain data.

### 1. The Expert Skill File

**Path**: `.claude/skills/resort-integration/SKILL.md`

---

## name: resort-environmental-integration
description: Expert in resort metadata management, Weather Unlocked API integration, and Mapbox tileset management. Focuses on scheduled polling, atomic caching, and dynamic map updates for SkiApp.
allowed-tools: Read, Grep, Glob, Bash(npm:test), Bash(redis-cli), Bash(curl)

# SkiApp Resort & Environmental Integration Skill

This skill governs the integration between SkiApp and external resort systems, weather stations, and Mapbox mapping services.

## Overview

This module acts as a high-performance proxy with scheduled background jobs. It fetches live data (lift status, weather, trail conditions) from external partners and caches it to ensure the mobile app receives updates in <10ms, even if the primary source is slow.

**Technology Stack:**

* **Scheduled Polling**: Google Cloud Functions triggered by Cloud Scheduler for Weather Unlocked API.
* **Caching**: Redis (GCP Memorystore) for high-frequency dynamic data (Weather/Lifts).
* **Cold Storage**: PostgreSQL for resort metadata, trail geometries, and facility info.
* **Map Integration**: Mapbox Tiling Service (MTS) and Datasets API for dynamic trail and POI updates.

## Implementation Standards

### 1. Weather Unlocked & Caching Expert

#### Scheduled Polling (Cloud Functions)

**Location**: `cloud-functions/weather-polling/`

* [ ] **Trigger**: Implement a Cloud Scheduler job that triggers a Cloud Function every 15 minutes to poll the Weather Unlocked Ski Resort API.
* [ ] **Atomic Cache**: The function must use `SETEX` in Redis to store normalized weather data. Use a key pattern: `resort:weather:{id}`.
* [ ] **Backend Fetch**: NestJS must never call Weather Unlocked directly during a user request; it must only read from the Redis cache populated by the Cloud Function.

### 2. Mapbox Backend Integration

**Location**: `src/modules/resort/mapbox.service.ts`

* [ ] **Tileset Updates**: When trail status changes (Open/Closed), the backend must use the Mapbox Tiling Service (MTS) API to push a "Tileset Recipe" update.
* [ ] **Dynamic Datasets**: Use the Mapbox Datasets API to store on-mountain POIs (Lodges, Amenities) programmatically from the backend.

### 3. Metadata Management (PostgreSQL)

**Location**: `src/modules/resort/resort.service.ts`

* [ ] **Resort Specs**: Maintain static data like base/summit altitudes and vertical drop as seen in the "Resort Details" UI.
* [ ] **Geospatial Boundaries**: Store resort and trail boundaries as PostGIS geometries for accurate "On-Mountain" detection.

### 4. Environmental Alerts

* [ ] **Priority Push**: If an avalanche warning or severe weather alert is detected, trigger an immediate broadcast to all users within the affected `resort_id`.