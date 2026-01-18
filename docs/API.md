# SkiMate Backend API Guide

Complete API documentation for React Native developers integrating with the SkiMate backend.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Connection Setup](#connection-setup)
- [Location Tracking](#location-tracking)
- [Chat Messaging](#chat-messaging)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

SkiMate uses **Socket.io WebSockets** for real-time communication. The backend exposes two namespaces:

| Namespace | Purpose | URL |
|-----------|---------|-----|
| `/location` | GPS tracking, ski sessions, friend proximity | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/location` |
| `/chat` | Messaging, typing indicators, read receipts | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/chat` |

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (public) |

---

## Quick Start

### 1. Install Dependencies

```bash
npm install socket.io-client @react-native-firebase/app @react-native-firebase/auth
# or
yarn add socket.io-client @react-native-firebase/app @react-native-firebase/auth
```

### 2. Create Socket Manager

```typescript
// src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import auth from '@react-native-firebase/auth';

const BASE_URL = 'https://skimate-api-dev-uge4k3ygea-uc.a.run.app';

class SocketManager {
  private locationSocket: Socket | null = null;
  private chatSocket: Socket | null = null;

  async getAuthToken(): Promise<string> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user.getIdToken();
  }

  async connectLocation(): Promise<Socket> {
    const token = await this.getAuthToken();
    
    this.locationSocket = io(`${BASE_URL}/location`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    return new Promise((resolve, reject) => {
      this.locationSocket!.on('connect', () => {
        console.log('Location socket connected');
        resolve(this.locationSocket!);
      });
      
      this.locationSocket!.on('connect_error', (error) => {
        console.error('Location connection error:', error);
        reject(error);
      });
    });
  }

  async connectChat(): Promise<Socket> {
    const token = await this.getAuthToken();
    
    this.chatSocket = io(`${BASE_URL}/chat`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    return new Promise((resolve, reject) => {
      this.chatSocket!.on('connect', () => {
        console.log('Chat socket connected');
        resolve(this.chatSocket!);
      });
      
      this.chatSocket!.on('connect_error', (error) => {
        console.error('Chat connection error:', error);
        reject(error);
      });
    });
  }

  disconnectAll(): void {
    this.locationSocket?.disconnect();
    this.chatSocket?.disconnect();
    this.locationSocket = null;
    this.chatSocket = null;
  }
}

export const socketManager = new SocketManager();
```

### 3. Initialize on App Start

```typescript
// App.tsx
import { useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { socketManager } from './services/socket';

function App() {
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        try {
          await socketManager.connectLocation();
          await socketManager.connectChat();
        } catch (error) {
          console.error('Failed to connect sockets:', error);
        }
      } else {
        socketManager.disconnectAll();
      }
    });

    return () => unsubscribe();
  }, []);

  // ... rest of app
}
```

---

## Connection Setup

### Authentication Handshake

All WebSocket connections require a Firebase ID token:

```typescript
const socket = io('wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/location', {
  transports: ['websocket'],
  auth: {
    token: firebaseIdToken  // Required
  }
});
```

### Token Refresh

Firebase tokens expire after 1 hour. Handle reconnection with fresh tokens:

```typescript
socket.on('connect_error', async (error) => {
  if (error.message === 'Authentication error') {
    // Get fresh token and reconnect
    const newToken = await auth().currentUser?.getIdToken(true);
    socket.auth = { token: newToken };
    socket.connect();
  }
});
```

### Connection Events

```typescript
socket.on('connect', () => {
  console.log('Connected with ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Reasons: 'io server disconnect', 'io client disconnect', 'ping timeout', etc.
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});
```

---

## Location Tracking

### Namespace: `/location`

Connect to the location namespace for GPS tracking and friend proximity.

### Start Ski Session

Before sending location pings, start a session:

```typescript
// Start session (optionally at a resort)
socket.emit('session:start', { resortId: 'optional-resort-uuid' }, (response) => {
  if (response.success) {
    console.log('Session started:', response.sessionId);
    console.log('Start time:', new Date(response.startTime));
    // Store sessionId for location pings
    setSessionId(response.sessionId);
  } else {
    console.error('Failed to start session');
  }
});
```

**Response:**
```typescript
interface SessionStartResponse {
  success: boolean;
  sessionId?: string;    // UUID
  startTime?: number;    // Unix timestamp (ms)
}
```

### Send Location Ping

Send GPS coordinates (max 1 per second):

```typescript
import Geolocation from '@react-native-community/geolocation';

// Get current position and send
Geolocation.getCurrentPosition(
  (position) => {
    socket.emit('location:ping', {
      sessionId: currentSessionId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude || 0,
      speed: position.coords.speed || 0,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      timestamp: position.timestamp,
    }, (response) => {
      if (response.throttled) {
        console.log('Ping throttled - sending too fast');
      } else if (!response.success) {
        console.error('Ping failed');
      }
    });
  },
  (error) => console.error('Geolocation error:', error),
  { enableHighAccuracy: true, timeout: 5000 }
);
```

**Request Payload:**
```typescript
interface LocationPing {
  sessionId: string;     // Active session UUID
  latitude: number;      // -90 to 90
  longitude: number;     // -180 to 180
  altitude: number;      // Meters above sea level
  speed: number;         // Meters per second
  accuracy: number;      // GPS accuracy in meters
  heading?: number;      // Compass heading (0-360)
  timestamp: number;     // Unix timestamp (ms)
}
```

**Response:**
```typescript
interface LocationPingResponse {
  success: boolean;
  throttled?: boolean;   // True if rate limited
}
```

### Subscribe to Friend Locations

Subscribe to receive real-time updates from friends:

```typescript
// Subscribe to specific friends
socket.emit('location:subscribe', {
  friendIds: ['friend-uuid-1', 'friend-uuid-2']
}, (response) => {
  if (response.success) {
    console.log('Subscribed to friend locations');
  }
});

// Listen for friend location updates
socket.on('location:update', (update) => {
  console.log(`Friend ${update.userId} is at:`, {
    lat: update.latitude,
    lng: update.longitude,
    speed: `${update.speed} m/s`,
    altitude: `${update.altitude}m`
  });
  // Update friend marker on map
  updateFriendMarker(update.userId, update.latitude, update.longitude);
});
```

**Location Update (Server → Client):**
```typescript
interface LocationUpdate {
  userId: string;        // Friend's user ID
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  timestamp: number;
  resortId?: string;
}
```

### Proximity Alerts

Receive alerts when friends are within 100 meters:

```typescript
socket.on('location:proximity', (alert) => {
  console.log(`🎿 ${alert.friendName} is ${alert.distance}m away!`);
  // Show notification or UI alert
  showProximityNotification(alert);
});
```

**Proximity Alert:**
```typescript
interface ProximityAlert {
  friendId: string;
  friendName: string;
  distance: number;      // Distance in meters
  latitude: number;
  longitude: number;
  timestamp: number;
}
```

### End Ski Session

End the session and get summary statistics:

```typescript
socket.emit('session:end', { sessionId: currentSessionId }, (response) => {
  if (response.success && response.summary) {
    const { summary } = response;
    console.log('Session Summary:');
    console.log(`  Total Vertical: ${summary.totalVertical}m`);
    console.log(`  Total Distance: ${(summary.totalDistance / 1000).toFixed(2)}km`);
    console.log(`  Max Speed: ${(summary.maxSpeed * 3.6).toFixed(1)} km/h`);
    console.log(`  Duration: ${Math.floor(summary.durationSeconds / 60)} minutes`);
    
    // Show session summary screen
    navigateToSessionSummary(summary);
  }
});
```

**Session Summary:**
```typescript
interface SessionSummary {
  totalVertical: number;   // Total descent in meters
  totalDistance: number;   // Total distance in meters
  maxSpeed: number;        // Max speed in m/s
  durationSeconds: number; // Session duration
}
```

### Complete Location Tracking Example

```typescript
// hooks/useLocationTracking.ts
import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import Geolocation from '@react-native-community/geolocation';

interface UseLocationTrackingOptions {
  socket: Socket;
  friendIds: string[];
}

export function useLocationTracking({ socket, friendIds }: UseLocationTrackingOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [nearbyFriends, setNearbyFriends] = useState<Map<string, LocationUpdate>>(new Map());
  const watchId = useRef<number | null>(null);

  // Start tracking
  const startTracking = async (resortId?: string) => {
    return new Promise<string>((resolve, reject) => {
      socket.emit('session:start', { resortId }, (response) => {
        if (response.success) {
          setSessionId(response.sessionId);
          setIsTracking(true);
          
          // Subscribe to friends
          socket.emit('location:subscribe', { friendIds });
          
          // Start watching position
          watchId.current = Geolocation.watchPosition(
            (position) => {
              socket.emit('location:ping', {
                sessionId: response.sessionId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude || 0,
                speed: position.coords.speed || 0,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                timestamp: position.timestamp,
              });
            },
            (error) => console.error('Watch error:', error),
            { 
              enableHighAccuracy: true, 
              distanceFilter: 5,  // Update every 5 meters
              interval: 1000,     // Or every 1 second
            }
          );
          
          resolve(response.sessionId);
        } else {
          reject(new Error('Failed to start session'));
        }
      });
    });
  };

  // Stop tracking
  const stopTracking = async () => {
    if (!sessionId) return null;
    
    return new Promise<SessionSummary | null>((resolve) => {
      // Stop watching position
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      
      socket.emit('session:end', { sessionId }, (response) => {
        setIsTracking(false);
        setSessionId(null);
        resolve(response.success ? response.summary : null);
      });
    });
  };

  // Listen for friend updates
  useEffect(() => {
    const handleLocationUpdate = (update: LocationUpdate) => {
      setNearbyFriends(prev => new Map(prev).set(update.userId, update));
    };

    const handleProximityAlert = (alert: ProximityAlert) => {
      // Trigger haptic feedback and notification
      console.log(`${alert.friendName} is ${alert.distance}m away!`);
    };

    socket.on('location:update', handleLocationUpdate);
    socket.on('location:proximity', handleProximityAlert);

    return () => {
      socket.off('location:update', handleLocationUpdate);
      socket.off('location:proximity', handleProximityAlert);
    };
  }, [socket]);

  return {
    sessionId,
    isTracking,
    nearbyFriends,
    startTracking,
    stopTracking,
  };
}
```

---

## Chat Messaging

### Namespace: `/chat`

Connect to the chat namespace for real-time messaging.

### Join a Chat Room

Join a group chat or direct message conversation:

```typescript
// Join group chat
socket.emit('chat:join', { groupId: 'group-uuid' }, (response) => {
  if (response.success) {
    console.log('Joined room:', response.roomId);
    setCurrentRoomId(response.roomId);
  }
});

// Join direct message
socket.emit('chat:join', { recipientId: 'user-uuid' }, (response) => {
  if (response.success) {
    console.log('Joined DM room:', response.roomId);
    setCurrentRoomId(response.roomId);
  }
});
```

**Response:**
```typescript
interface ChatJoinResponse {
  success: boolean;
  roomId?: string;   // Room identifier for this conversation
}
```

### Get Message History

Load previous messages when joining a room:

```typescript
socket.emit('chat:history', {
  groupId: 'group-uuid',  // or recipientId for DMs
  limit: 50               // Number of messages (max 100)
}, (response) => {
  if (response.success) {
    setMessages(response.messages);
  }
});
```

**Response:**
```typescript
interface ChatHistoryResponse {
  success: boolean;
  messages?: Array<{
    id: string;
    senderId: string;
    content: string;
    sentAt: string;  // ISO 8601
  }>;
}
```

### Send a Message

```typescript
// Send text message to group
socket.emit('chat:send', {
  groupId: 'group-uuid',
  content: 'Anyone want to ski together?',
  metadata: { type: 'text' }
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.messageId);
  }
});

// Send location message (share your location)
socket.emit('chat:send', {
  recipientId: 'friend-uuid',
  content: "I'm here!",
  metadata: {
    type: 'location',
    location: {
      latitude: 46.8527,
      longitude: -121.7604
    }
  }
}, (response) => {
  if (response.success) {
    console.log('Location shared');
  }
});

// Send meetup request
socket.emit('chat:send', {
  groupId: 'group-uuid',
  content: 'Want to meet up?',
  metadata: { type: 'meetup_request' }
}, (response) => {
  if (response.success) {
    console.log('Meetup request sent');
  }
});
```

**Request Payload:**
```typescript
interface SendMessagePayload {
  groupId?: string;       // For group chat
  recipientId?: string;   // For direct message
  content: string;        // Message text
  metadata?: {
    type?: 'text' | 'image' | 'location' | 'meetup_request';
    imageUrl?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}
```

**Response:**
```typescript
interface ChatSendResponse {
  success: boolean;
  messageId?: string;
  sentAt?: string;  // ISO 8601
}
```

### Receive Messages

Listen for incoming messages:

```typescript
socket.on('chat:message', (message) => {
  console.log('New message from:', message.senderId);
  console.log('Content:', message.content);
  
  // Add to messages list
  setMessages(prev => [...prev, {
    id: message.id,
    senderId: message.senderId,
    content: message.content,
    metadata: message.metadata,
    sentAt: message.sentAt,
  }]);
});
```

**Incoming Message:**
```typescript
interface ChatMessageReceived {
  id: string;
  senderId: string;
  groupId?: string;
  recipientId?: string;
  content: string;
  metadata?: MessageMetadata;
  sentAt: string;  // ISO 8601
}
```

### Typing Indicators

Show when users are typing:

```typescript
// Send typing indicator
const handleTextChange = (text: string) => {
  setText(text);
  
  // Send typing status (debounced)
  socket.emit('chat:typing', {
    groupId: currentGroupId,
    isTyping: text.length > 0
  });
};

// Stop typing when done
const handleSend = () => {
  socket.emit('chat:typing', {
    groupId: currentGroupId,
    isTyping: false
  });
  // ... send message
};

// Listen for others typing
socket.on('chat:typing', ({ userId, roomId, isTyping }) => {
  if (isTyping) {
    setTypingUsers(prev => [...prev, userId]);
  } else {
    setTypingUsers(prev => prev.filter(id => id !== userId));
  }
});
```

### Read Receipts

Mark messages as read:

```typescript
// When user views a message
const markAsRead = (messageId: string, groupId?: string) => {
  socket.emit('chat:read', { messageId, groupId }, (response) => {
    if (response.success) {
      console.log('Marked as read');
    }
  });
};

// Listen for read receipts from others
socket.on('chat:read', ({ messageId, userId, readAt }) => {
  console.log(`User ${userId} read message ${messageId} at ${readAt}`);
  // Update message UI to show read status
  updateMessageReadStatus(messageId, userId, readAt);
});
```

### Leave Chat Room

```typescript
socket.emit('chat:leave', { roomId: currentRoomId }, (response) => {
  if (response.success) {
    console.log('Left room');
    setCurrentRoomId(null);
  }
});
```

### Complete Chat Example

```typescript
// hooks/useChat.ts
import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
  id: string;
  senderId: string;
  content: string;
  metadata?: MessageMetadata;
  sentAt: string;
}

interface UseChatOptions {
  socket: Socket;
  groupId?: string;
  recipientId?: string;
}

export function useChat({ socket, groupId, recipientId }: UseChatOptions) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Join room and load history
  useEffect(() => {
    if (!groupId && !recipientId) return;

    setIsLoading(true);

    // Join the room
    socket.emit('chat:join', { groupId, recipientId }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        
        // Load message history
        socket.emit('chat:history', { groupId, recipientId, limit: 50 }, (historyResponse) => {
          if (historyResponse.success) {
            setMessages(historyResponse.messages || []);
          }
          setIsLoading(false);
        });
      }
    });

    // Listen for new messages
    const handleMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    // Listen for typing
    const handleTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => 
        isTyping 
          ? [...prev.filter(id => id !== userId), userId]
          : prev.filter(id => id !== userId)
      );
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      if (roomId) {
        socket.emit('chat:leave', { roomId });
      }
    };
  }, [socket, groupId, recipientId]);

  // Send message
  const sendMessage = useCallback((content: string, metadata?: MessageMetadata) => {
    return new Promise<boolean>((resolve) => {
      socket.emit('chat:send', {
        groupId,
        recipientId,
        content,
        metadata,
      }, (response) => {
        resolve(response.success);
      });
    });
  }, [socket, groupId, recipientId]);

  // Send typing indicator
  const setTyping = useCallback((isTyping: boolean) => {
    socket.emit('chat:typing', {
      groupId,
      recipientId,
      isTyping,
    });
  }, [socket, groupId, recipientId]);

  // Mark message as read
  const markRead = useCallback((messageId: string) => {
    socket.emit('chat:read', { messageId, groupId });
  }, [socket, groupId]);

  return {
    roomId,
    messages,
    typingUsers,
    isLoading,
    sendMessage,
    setTyping,
    markRead,
  };
}
```

---

## Error Handling

### Connection Errors

```typescript
socket.on('connect_error', (error) => {
  if (error.message === 'Authentication error') {
    // Token expired or invalid
    handleAuthError();
  } else if (error.message === 'timeout') {
    // Connection timeout
    showNetworkError();
  }
});
```

### Event Errors

All events return a `success: boolean` field:

```typescript
socket.emit('session:start', {}, (response) => {
  if (!response.success) {
    // Handle error - show user feedback
    Alert.alert('Error', 'Failed to start session. Please try again.');
  }
});
```

### Common Error Scenarios

| Scenario | Cause | Solution |
|----------|-------|----------|
| `connect_error` with "Authentication error" | Invalid/expired token | Refresh Firebase token |
| `success: false` on events | Server-side validation failed | Check payload format |
| `throttled: true` on location:ping | Sending > 1 ping/second | Reduce ping frequency |
| Disconnect with "ping timeout" | Network issues | Auto-reconnect handles this |

---

## Rate Limiting

### Location Pings

- **Limit**: 1 ping per second per client
- **Behavior**: Excess pings return `{ success: false, throttled: true }`

```typescript
// Recommended: Use interval-based sending
const sendLocationInterval = useRef<NodeJS.Timer | null>(null);

const startSendingLocation = () => {
  sendLocationInterval.current = setInterval(() => {
    // Get and send location
  }, 1000); // Exactly 1 per second
};

const stopSendingLocation = () => {
  if (sendLocationInterval.current) {
    clearInterval(sendLocationInterval.current);
  }
};
```

### Typing Indicators

- **TTL**: 5 seconds auto-expiry
- **Best Practice**: Debounce typing events

```typescript
import { debounce } from 'lodash';

const sendTyping = debounce((isTyping: boolean) => {
  socket.emit('chat:typing', { groupId, isTyping });
}, 300);
```

---

## Server URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://skimate-api-dev-uge4k3ygea-uc.a.run.app` |
| Development | `http://localhost:3000` |

### WebSocket Namespaces

| Namespace | Full URL |
|-----------|----------|
| Location | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/location` |
| Chat | `wss://skimate-api-dev-uge4k3ygea-uc.a.run.app/chat` |

---

## Additional Resources

### Hosted Documentation

All documentation is hosted at: **https://skimate-api-dev-uge4k3ygea-uc.a.run.app/docs**

| Page | URL |
|------|-----|
| AsyncAPI Spec (Interactive) | `/docs` |
| API Guide | `/docs/api` |
| Authentication | `/docs/auth` |
| Data Models | `/docs/models` |

### Source Files

- [Authentication Guide](./AUTHENTICATION.md) - Firebase auth setup
- [Data Models](./MODELS.md) - TypeScript interfaces and enums
- [AsyncAPI Spec](./asyncapi.yaml) - Machine-readable API specification
