
### 2. The Environmental Logic Guide

**Path**: `.claude/skills/resort-integration/environmental-data.md`

# Environmental & Resort Data Logic

This document details the synchronization logic for mountain conditions and facility information.

## 1. Synchronization Intervals

To maintain "ultra-fastness" without overloading 3rd-party partners, the following sync schedule is enforced:

| Data Type | Sync Frequency | Storage |
| --- | --- | --- |
| **Lift Status** | Every 2 Minutes | Redis (TTL 5m) |
| **Trail Conditions** | Every 5 Minutes | Redis (TTL 10m) |
| **Weather Forecast** | Every 15 Minutes | Redis (TTL 30m) |
| **Resort Metadata** | Every 24 Hours | PostgreSQL |

## 2. The Proxy Logic Flow

1. **Request**: Mobile client requests "Keystone" status.
2. **Cache Check**: Backend checks Redis for `resort:status:keystone`.
3. **Fast Return**: If present, return data immediately ().
4. **Background Refresh**: If data is  minutes old, trigger an asynchronous refresh job via BullMQ to fetch fresh data from the resort API.
5. **Fallback**: If the resort API is down, return the cached data with a `stale: true` flag to inform the UI.

## 3. Data Mapping & Normalization

External APIs often use different formats. The backend must normalize all data into the SkiApp standard:

* **Difficulty Scaling**: Map various resort difficulty systems (e.g., "Diamond" vs. "Black") to the internal `Easy`, `Intermediate`, `Difficult` enum used in the UI.
* **Coordinate Projection**: Ensure all incoming coordinates are converted to `EPSG:4326` (WGS 84) before saving to PostGIS.
* **Metric Conversion**: Automatically convert temperatures and wind speeds based on the requesting user's `user_preferences.units`.

## 4. Safety Constraints

* 
**Navigation Override**: If a lift or trail is marked `Status: Closed` in the cache, the Navigation Service must automatically trigger a re-route for any active users heading toward that facility.


* 
**Hazard Buffers**: When a hazard (e.g., "Thin Cover") is reported on a specific trail, apply a 10-meter virtual buffer around that trail's PostGIS LineString to alert users in proximity.



---

### Performance Checklist for Agents

* [ ] Is the external API request timeout set to < 5 seconds to prevent hanging the event loop?
* [ ] Are we using `Promise.allSettled` when fetching from multiple environmental sources?
* [ ] Is the "Check Resort Status Page" link in the UI being served from the `resorts.official_status_url` database field?
