### 2. The Logic Implementation Guide

**Path**: `.claude/skills/location-proximity/geofencing-logic.md`

# Geofencing & Movement Logic for SkiApp

This document defines how the system detects if a user is on a trail, entering a dangerous zone, or boarding a lift.

## 1. State Detection Logic

The system must automatically differentiate between skiing, riding a lift, and being stationary.

| Movement Type | Logic Condition |
| --- | --- |
| **Skiing (Run)** |  and  is decreasing. |
| **Lifting** | User is within 5m of a `lifts.path` (LineString) and  is increasing.|
| **Stationary** | <br> for  seconds.|

## 2. Geofencing for Safety (PostGIS)

While live location uses Redis, "Safety Alerts" use PostGIS for high-precision boundary checks.

### Avalanche & Hazard Zones

**Query Pattern**:

```sql
-- Check if user is entering a high-risk area
SELECT hazard_type, severity 
FROM safety_zones 
WHERE ST_Contains(boundary, ST_SetSRID(ST_Point(:lng, :lat), 4326))
AND active = true;

```

* **Trigger**: This check should run every 5 pings or whenever the user moves > 50 meters to save CPU cycles.
* **Action**: If a hazard is detected, bypass standard notification queues and push an immediate SOS/Warning alert.

## 3. Dynamic Re-routing Logic

When a user is following a planned route and misses a turn.

1. **Deviation Detection**: Calculate the perpendicular distance between the user's `Point` and the active `trails.path` (LineString).
2. 
**Threshold**: If distance , trigger a "Wrong Turn" event.

3. **Recalculation**:
* Find the nearest `Node` (intersection) in the trail network.
* Use the `pgRouting` extension in PostgreSQL to calculate a new optimal path based on user skill level.

## 4. Performance Checklist

* [ ] Are we using `ST_DWithin` instead of `ST_Distance`? (DWithin is indexed and 10x faster).
* [ ] Are we caching the `resort_boundary` in Redis to avoid hitting Postgres for "Are they at the resort?" checks?
* [ ] Is the SOS override logic active for users in an "Emergency" state? 
