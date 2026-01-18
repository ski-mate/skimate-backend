# SkiMate Data Models Reference

Complete TypeScript/JavaScript type definitions for all data models used in the SkiMate backend.

## Table of Contents

- [Enums](#enums)
- [User Models](#user-models)
- [Location Models](#location-models)
- [Chat Models](#chat-models)
- [Resort Models](#resort-models)
- [Session Models](#session-models)

---

## Enums

### Gender

```typescript
enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
  PREFER_NOT_TO_SAY = 'Prefer not to say',
}
```

### SkillLevel

```typescript
enum SkillLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
  EXPERT = 'Expert',
}
```

### Units

```typescript
enum Units {
  METRIC = 'Metric',
  IMPERIAL = 'Imperial',
}
```

### FriendshipStatus

```typescript
enum FriendshipStatus {
  PENDING = 'Pending',
  ACCEPTED = 'Accepted',
  BLOCKED = 'Blocked',
}
```

### TrailDifficulty

```typescript
enum TrailDifficulty {
  EASY = 'Easy',           // Green circle
  INTERMEDIATE = 'Intermediate',  // Blue square
  DIFFICULT = 'Difficult',     // Black diamond
  EXPERT = 'Expert',        // Double black diamond
}
```

### TrailStatus

```typescript
enum TrailStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
  GROOMING = 'Grooming',
}
```

### LiftType

```typescript
enum LiftType {
  CHAIRLIFT = 'Chairlift',
  GONDOLA = 'Gondola',
  TRAM = 'Tram',
  SURFACE = 'Surface',
}
```

### LiftStatus

```typescript
enum LiftStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
  ON_HOLD = 'On Hold',
}
```

### MessageType

```typescript
type MessageType = 'text' | 'image' | 'location' | 'meetup_request';
```

---

## User Models

### User

Main user entity. The `id` matches the Firebase UID.

```typescript
interface User {
  /** UUID matching Firebase UID */
  id: string;
  
  /** User's email address */
  email: string;
  
  /** Full display name */
  fullName: string;
  
  /** Optional phone number */
  phoneNumber?: string;
  
  /** User's gender */
  gender: Gender;
  
  /** Date of birth (ISO 8601 date string) */
  dateOfBirth: string;
  
  /** Skiing ability level */
  skillLevel: SkillLevel;
  
  /** Profile picture URL */
  avatarUrl?: string;
  
  /** Account creation timestamp */
  createdAt: string;
  
  /** Last update timestamp */
  updatedAt: string;
}
```

### UserPreferences

User settings and preferences stored as JSONB.

```typescript
interface UserPreferences {
  /** Associated user ID */
  userId: string;
  
  /** Measurement units preference */
  units: Units;
  
  /** Whether to share location with friends */
  shareLocation: boolean;
  
  /** Whether to show on friend maps */
  showOnMap: boolean;
  
  /** Notification settings */
  notifications: NotificationPreferences;
  
  /** Preferred resorts (UUID array) */
  favoriteResorts: string[];
}

interface NotificationPreferences {
  /** Push notifications for friend proximity */
  proximityAlerts: boolean;
  
  /** Push notifications for new messages */
  chatMessages: boolean;
  
  /** Push notifications for friend requests */
  friendRequests: boolean;
  
  /** Push notifications for resort conditions */
  resortUpdates: boolean;
}
```

### Friendship

Represents a friendship connection between two users.

```typescript
interface Friendship {
  /** Unique friendship ID */
  id: string;
  
  /** First user ID (requester) */
  userId1: string;
  
  /** Second user ID (recipient) */
  userId2: string;
  
  /** Current friendship status */
  status: FriendshipStatus;
  
  /** When the request was created */
  createdAt: string;
}
```

---

## Location Models

### LocationPing

GPS data sent from the mobile device.

```typescript
interface LocationPing {
  /** User ID (auto-populated from auth) */
  userId: string;
  
  /** Active session ID */
  sessionId: string;
  
  /** GPS latitude (-90 to 90) */
  latitude: number;
  
  /** GPS longitude (-180 to 180) */
  longitude: number;
  
  /** Altitude in meters above sea level */
  altitude: number;
  
  /** Speed in meters per second */
  speed: number;
  
  /** GPS accuracy in meters */
  accuracy: number;
  
  /** Compass heading in degrees (0-360) */
  heading?: number;
  
  /** Unix timestamp in milliseconds */
  timestamp: number;
}
```

### LocationPingResponse

Server response to location ping.

```typescript
interface LocationPingResponse {
  /** Whether the ping was processed successfully */
  success: boolean;
  
  /** True if rate limited (sending too fast) */
  throttled?: boolean;
}
```

### LocationUpdate

Friend location update received from server.

```typescript
interface LocationUpdate {
  /** Friend's user ID */
  userId: string;
  
  /** GPS latitude */
  latitude: number;
  
  /** GPS longitude */
  longitude: number;
  
  /** Altitude in meters */
  altitude: number;
  
  /** Speed in meters per second */
  speed: number;
  
  /** Unix timestamp in milliseconds */
  timestamp: number;
  
  /** Resort ID if at a resort */
  resortId?: string;
}
```

### ProximityAlert

Alert when a friend is within 100 meters.

```typescript
interface ProximityAlert {
  /** Friend's user ID */
  friendId: string;
  
  /** Friend's display name */
  friendName: string;
  
  /** Distance in meters */
  distance: number;
  
  /** Friend's latitude */
  latitude: number;
  
  /** Friend's longitude */
  longitude: number;
  
  /** Unix timestamp in milliseconds */
  timestamp: number;
}
```

### LocationSubscribeRequest

Request to subscribe to friend locations.

```typescript
interface LocationSubscribeRequest {
  /** Array of friend user IDs to subscribe to */
  friendIds: string[];
}
```

---

## Chat Models

### ChatJoinRequest

Request to join a chat room.

```typescript
interface ChatJoinRequest {
  /** Group ID for group chat (optional) */
  groupId?: string;
  
  /** Recipient user ID for direct message (optional) */
  recipientId?: string;
}
```

### ChatJoinResponse

Response when joining a chat room.

```typescript
interface ChatJoinResponse {
  /** Whether join was successful */
  success: boolean;
  
  /** Room identifier for this conversation */
  roomId?: string;
}
```

### SendMessagePayload

Payload for sending a message.

```typescript
interface SendMessagePayload {
  /** Target group ID (for group chat) */
  groupId?: string;
  
  /** Target user ID (for direct message) */
  recipientId?: string;
  
  /** Message content (1-4000 characters) */
  content: string;
  
  /** Optional message metadata */
  metadata?: MessageMetadata;
}
```

### MessageMetadata

Additional message data.

```typescript
interface MessageMetadata {
  /** Type of message */
  type?: 'text' | 'image' | 'location' | 'meetup_request';
  
  /** Image URL for image messages */
  imageUrl?: string;
  
  /** Location data for location messages */
  location?: {
    latitude: number;
    longitude: number;
  };
  
  /** Meetup request ID */
  meetupRequestId?: string;
}
```

### ChatSendResponse

Response after sending a message.

```typescript
interface ChatSendResponse {
  /** Whether message was sent successfully */
  success: boolean;
  
  /** Unique message identifier */
  messageId?: string;
  
  /** ISO 8601 timestamp when message was sent */
  sentAt?: string;
}
```

### ChatMessage

Message received from server.

```typescript
interface ChatMessage {
  /** Unique message ID */
  id: string;
  
  /** Sender's user ID */
  senderId: string;
  
  /** Group ID (for group messages) */
  groupId?: string;
  
  /** Recipient ID (for direct messages) */
  recipientId?: string;
  
  /** Message content */
  content: string;
  
  /** Message metadata */
  metadata?: MessageMetadata;
  
  /** ISO 8601 timestamp */
  sentAt: string;
}
```

### ChatHistoryMessage

Simplified message format in history response.

```typescript
interface ChatHistoryMessage {
  /** Unique message ID */
  id: string;
  
  /** Sender's user ID */
  senderId: string;
  
  /** Message content */
  content: string;
  
  /** ISO 8601 timestamp */
  sentAt: string;
}
```

### ChatHistoryRequest

Request for message history.

```typescript
interface ChatHistoryRequest {
  /** Group ID (for group chat) */
  groupId?: string;
  
  /** Recipient ID (for direct message) */
  recipientId?: string;
  
  /** Number of messages to retrieve (1-100, default 50) */
  limit?: number;
}
```

### ChatHistoryResponse

Response containing message history.

```typescript
interface ChatHistoryResponse {
  /** Whether request was successful */
  success: boolean;
  
  /** Array of messages */
  messages?: ChatHistoryMessage[];
}
```

### TypingPayload

Typing indicator payload.

```typescript
interface TypingPayload {
  /** Group ID (for group chat) */
  groupId?: string;
  
  /** Recipient ID (for direct message) */
  recipientId?: string;
  
  /** Whether user is currently typing */
  isTyping: boolean;
}
```

### TypingIndicator

Typing indicator received from server.

```typescript
interface TypingIndicator {
  /** User who is typing */
  userId: string;
  
  /** Room identifier */
  roomId: string;
  
  /** Whether they are typing */
  isTyping: boolean;
}
```

### ReadReceiptPayload

Request to mark message as read.

```typescript
interface ReadReceiptPayload {
  /** Message ID to mark as read */
  messageId: string;
  
  /** Group ID (optional) */
  groupId?: string;
}
```

### ReadReceipt

Read receipt received from server.

```typescript
interface ReadReceipt {
  /** Message that was read */
  messageId: string;
  
  /** User who read it */
  userId: string;
  
  /** ISO 8601 timestamp when read */
  readAt: string;
}
```

### Group

Chat group entity.

```typescript
interface Group {
  /** Unique group ID */
  id: string;
  
  /** Group display name */
  name: string;
  
  /** Group description */
  description?: string;
  
  /** Group avatar URL */
  avatarUrl?: string;
  
  /** Creator's user ID */
  createdBy: string;
  
  /** ISO 8601 creation timestamp */
  createdAt: string;
  
  /** Array of member user IDs */
  memberIds?: string[];
}
```

---

## Resort Models

### Resort

Ski resort entity.

```typescript
interface Resort {
  /** Unique resort ID */
  id: string;
  
  /** Resort name */
  name: string;
  
  /** Location/city name */
  locationName: string;
  
  /** Base elevation in meters */
  baseAltitude: number;
  
  /** Summit elevation in meters */
  summitAltitude: number;
  
  /** Total vertical drop in meters */
  verticalDrop?: number;
  
  /** Resort boundary (WKT Polygon) */
  boundary?: string;
  
  /** Center point (WKT Point) */
  centerPoint?: string;
  
  /** Additional metadata */
  metadata?: ResortMetadata;
  
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

interface ResortMetadata {
  /** Official website URL */
  website?: string;
  
  /** URL for live status updates */
  officialStatusUrl?: string;
  
  /** Timezone identifier (e.g., "America/Denver") */
  timezone?: string;
  
  /** Country code */
  country?: string;
  
  /** State/province/region */
  region?: string;
}
```

### Trail

Ski trail/run entity.

```typescript
interface Trail {
  /** Unique trail ID */
  id: string;
  
  /** Trail name */
  name: string;
  
  /** Parent resort ID */
  resortId: string;
  
  /** Trail difficulty rating */
  difficulty: TrailDifficulty;
  
  /** Current trail status */
  status: TrailStatus;
  
  /** Trail path (WKT LineString) */
  path?: string;
  
  /** Trail length in meters */
  length?: number;
  
  /** Vertical drop in meters */
  verticalDrop?: number;
  
  /** ISO 8601 last status update */
  statusUpdatedAt?: string;
}
```

### Lift

Ski lift entity.

```typescript
interface Lift {
  /** Unique lift ID */
  id: string;
  
  /** Lift name */
  name: string;
  
  /** Parent resort ID */
  resortId: string;
  
  /** Type of lift */
  liftType: LiftType;
  
  /** Current lift status */
  status: LiftStatus;
  
  /** Number of seats per chair/cabin */
  capacity?: number;
  
  /** Vertical rise in meters */
  verticalRise?: number;
  
  /** Estimated wait time in minutes */
  waitTimeMinutes?: number;
  
  /** ISO 8601 last status update */
  statusUpdatedAt?: string;
}
```

### WeatherData

Resort weather information.

```typescript
interface WeatherData {
  /** Resort ID */
  resortId: string;
  
  /** Temperature in Celsius */
  temperatureCelsius: number;
  
  /** Feels-like temperature in Celsius */
  feelsLikeCelsius: number;
  
  /** Wind speed in km/h */
  windSpeedKmh: number;
  
  /** Wind direction (e.g., "NW") */
  windDirection: string;
  
  /** Current conditions (e.g., "Snowing", "Partly Cloudy") */
  conditions: string;
  
  /** Visibility in km */
  visibilityKm: number;
  
  /** Snow depth at base in cm */
  snowDepthBaseCm: number;
  
  /** Snow depth at summit in cm */
  snowDepthSummitCm: number;
  
  /** New snow in last 24h in cm */
  newSnow24hCm: number;
  
  /** ISO 8601 timestamp when data was fetched */
  updatedAt: string;
}
```

---

## Session Models

### SessionStartRequest

Request to start a ski session.

```typescript
interface SessionStartRequest {
  /** Optional resort ID to associate with session */
  resortId?: string;
}
```

### SessionStartResponse

Response when starting a session.

```typescript
interface SessionStartResponse {
  /** Whether session started successfully */
  success: boolean;
  
  /** Unique session identifier */
  sessionId?: string;
  
  /** Unix timestamp in milliseconds */
  startTime?: number;
}
```

### SessionEndRequest

Request to end a ski session.

```typescript
interface SessionEndRequest {
  /** Session ID to end */
  sessionId: string;
}
```

### SessionEndResponse

Response when ending a session.

```typescript
interface SessionEndResponse {
  /** Whether session ended successfully */
  success: boolean;
  
  /** Session statistics summary */
  summary?: SessionSummary;
}
```

### SessionSummary

Summary statistics for a completed session.

```typescript
interface SessionSummary {
  /** Total vertical descent in meters */
  totalVertical: number;
  
  /** Total distance traveled in meters */
  totalDistance: number;
  
  /** Maximum speed achieved in m/s */
  maxSpeed: number;
  
  /** Session duration in seconds */
  durationSeconds: number;
}
```

### SkiSession

Full ski session entity (stored in database).

```typescript
interface SkiSession {
  /** Unique session ID */
  id: string;
  
  /** User who owns this session */
  userId: string;
  
  /** Associated resort (optional) */
  resortId?: string;
  
  /** Total vertical descent in meters */
  totalVertical: number;
  
  /** Total distance in meters */
  totalDistance: number;
  
  /** Maximum speed in m/s */
  maxSpeed: number;
  
  /** Session start time */
  startTime: string;
  
  /** Session end time (null if active) */
  endTime?: string;
  
  /** Whether session is currently active */
  isActive: boolean;
  
  /** Detailed session statistics */
  stats?: SessionStats;
  
  /** Linked Strava activity ID */
  stravaActivityId?: string;
  
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

interface SessionStats {
  /** Number of runs completed */
  totalRuns?: number;
  
  /** Longest single run in meters */
  longestRun?: number;
  
  /** Average speed in m/s */
  avgSpeed?: number;
  
  /** Number of lift rides */
  liftRides?: number;
  
  /** Time spent on lifts in seconds */
  timeOnLift?: number;
  
  /** Time spent skiing in seconds */
  timeSkiing?: number;
}
```

---

## Utility Types

### SuccessResponse

Generic success response.

```typescript
interface SuccessResponse {
  success: boolean;
}
```

### ErrorResponse

Generic error response.

```typescript
interface ErrorResponse {
  success: false;
  error?: string;
  code?: string;
}
```

### Coordinates

Simple coordinate pair.

```typescript
interface Coordinates {
  latitude: number;
  longitude: number;
}
```

### PaginatedResponse

Generic paginated response wrapper.

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

---

## Unit Conversions

Helper functions for unit conversions:

```typescript
// Speed conversions
const msToKmh = (ms: number): number => ms * 3.6;
const msToMph = (ms: number): number => ms * 2.237;
const kmhToMs = (kmh: number): number => kmh / 3.6;

// Distance conversions
const metersToKm = (m: number): number => m / 1000;
const metersToMiles = (m: number): number => m / 1609.344;
const metersToFeet = (m: number): number => m * 3.281;

// Temperature conversions
const celsiusToFahrenheit = (c: number): number => (c * 9/5) + 32;
const fahrenheitToCelsius = (f: number): number => (f - 32) * 5/9;

// Example usage
const speedKmh = msToKmh(12.5);  // 45 km/h
const distanceKm = metersToKm(5280);  // 5.28 km
const tempF = celsiusToFahrenheit(-5);  // 23°F
```

---

## Additional Resources

- [API Guide](./API.md) - Complete WebSocket API documentation
- [Authentication](./AUTHENTICATION.md) - Firebase auth setup
- [AsyncAPI Spec](./asyncapi.yaml) - Machine-readable API specification
