### 2. The Persistence Implementation Guide

**Path**: `.claude/skills/messaging-service/chat-persistence.md`

# Chat Persistence & Coordination Logic

This document details the data lifecycle for messages and the mathematical logic for group coordination.

## 1. Data Lifecycle: The Write-Behind Pattern

To achieve sub-50ms message delivery, we bypass direct database writes in the critical path.

1. **Ingestion**: Client sends message via WebSocket.
2. **Broadcast**: Backend emits message to recipient(s) immediately via Socket.io.
3. **Cache**: Message is added to Redis `LPUSH` with an `LTRIM` to maintain only the latest 50 entries.
4. **Queue**: A "persist-message" job is added to the `chat-queue` (BullMQ).
5. **Persistence**: The worker picks up the job and performs a batch insert into the `messages` table in PostgreSQL.

## 2. Group Coordination: Midpoint Calculation

The "Find Midpoint" feature uses the following geospatial logic:

* 
**Input**: An array of `Point(lng, lat)` for all group members currently sharing their location.


* **Process**:
* Convert all coordinates to Cartesian .
* Calculate the average  and .
* Convert back to Latitude and Longitude.


* 
**Output**: A central coordinate used as the "Meeting Point".



## 3. Communication Safeguards

### Privacy & Consent

* [ ] **Consent Check**: Before a meet-up request is sent or a location is shared on the map, verify the `user_preferences.location_sharing_enabled` flag.


* [ ] **Session Expiry**: Location sharing must automatically expire when the recording session ends.



### Failure Handling

* [ ] **Offline Storage**: If the WebSocket is disconnected, the mobile client must buffer messages locally and sync them using the `last_synced_at` timestamp upon reconnection.


* [ ] **Retry Logic**: BullMQ must be configured with at least 3 retries and exponential backoff for database persistence failures.

---

### Performance Checklist for Agents

* [ ] Is the "Read Receipt" logic using Redis bitsets or hashes for efficiency?
* [ ] Does the "Meet-up" calculation exclude members who haven't moved in > 30 minutes?
* [ ] Are we using `JSONB` for message metadata to support rich media (photos, location pins) without schema changes? 