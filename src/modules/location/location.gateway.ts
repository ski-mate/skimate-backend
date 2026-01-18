import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { LocationService } from './location.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import type { LocationPing, LocationUpdate } from '../../proto/location.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    uid: string;
    email?: string;
  };
}

@WebSocketGateway({
  namespace: '/location',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class LocationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LocationGateway.name);
  private lastPingTimestamps = new Map<string, number>();
  private readonly THROTTLE_MS = 1000; // 1 ping per second max

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly locationService: LocationService,
  ) {}

  afterInit(): void {
    // Redis adapter is configured at the application level in main.ts
    // This gateway is ready to handle location events
    this.logger.log('Location Gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket): void {
    // Authentication is handled by WsAuthGuard on individual messages
    // Here we just log the connection
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.user?.uid;
    
    if (userId) {
      // Remove user from active connections
      await this.redis.srem(`connections:${userId}`, client.id);
      
      // Check if user has no more connections
      const remainingConnections = await this.redis.scard(`connections:${userId}`);
      
      if (remainingConnections === 0) {
        // User is fully disconnected - handle session pause/end
        await this.locationService.handleUserDisconnect(userId);
      }
    }
    
    this.lastPingTimestamps.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('location:ping')
  async handleLocationPing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LocationPing,
  ): Promise<{ success: boolean; throttled?: boolean }> {
    const userId = client.user?.uid;
    
    if (!userId) {
      return { success: false };
    }

    // Throttle: max 1 ping per second per client
    const lastPing = this.lastPingTimestamps.get(client.id) ?? 0;
    const now = Date.now();
    
    if (now - lastPing < this.THROTTLE_MS) {
      return { success: false, throttled: true };
    }
    
    this.lastPingTimestamps.set(client.id, now);

    try {
      // Process the location ping
      const nearbyFriends = await this.locationService.processLocationPing(
        userId,
        data,
      );

      // Broadcast to nearby friends
      for (const friend of nearbyFriends) {
        const friendSocketIds = await this.redis.smembers(
          `connections:${friend.friendId}`,
        );
        
        const locationUpdate: LocationUpdate = {
          userId,
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          speed: data.speed,
          timestamp: data.timestamp,
        };

        for (const socketId of friendSocketIds) {
          this.server.to(socketId).emit('location:update', locationUpdate);
        }

        // Send proximity alert if very close (< 100m)
        if (friend.distance < 100) {
          this.server.to(client.id).emit('location:proximity', {
            friendId: friend.friendId,
            friendName: friend.friendName,
            distance: friend.distance,
            latitude: friend.latitude,
            longitude: friend.longitude,
            timestamp: now,
          });
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Location ping error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('session:start')
  async handleSessionStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { resortId?: string },
  ): Promise<{ success: boolean; sessionId?: string; startTime?: number }> {
    const userId = client.user?.uid;
    
    if (!userId) {
      return { success: false };
    }

    try {
      const session = await this.locationService.startSession(
        userId,
        data.resortId,
      );

      // Track user's socket connection
      await this.redis.sadd(`connections:${userId}`, client.id);

      return {
        success: true,
        sessionId: session.id,
        startTime: session.startTime.getTime(),
      };
    } catch (error) {
      this.logger.error(`Session start error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('session:end')
  async handleSessionEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ): Promise<{
    success: boolean;
    summary?: {
      totalVertical: number;
      totalDistance: number;
      maxSpeed: number;
      durationSeconds: number;
    };
  }> {
    const userId = client.user?.uid;
    
    if (!userId) {
      return { success: false };
    }

    try {
      const summary = await this.locationService.endSession(
        userId,
        data.sessionId,
      );

      return {
        success: true,
        summary: {
          totalVertical: summary.totalVertical,
          totalDistance: summary.totalDistance,
          maxSpeed: summary.maxSpeed,
          durationSeconds: summary.durationSeconds,
        },
      };
    } catch (error) {
      this.logger.error(`Session end error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('location:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { friendIds: string[] },
  ): Promise<{ success: boolean }> {
    const userId = client.user?.uid;
    
    if (!userId) {
      return { success: false };
    }

    try {
      // Subscribe to friend location updates
      // This creates a Redis subscription pattern for the user
      await this.locationService.subscribeToFriends(userId, data.friendIds);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Subscribe error: ${(error as Error).message}`);
      return { success: false };
    }
  }
}
