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
import { ChatService } from './chat.service.js';
import { WsAuthGuard } from '../location/guards/ws-auth.guard.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    uid: string;
    email?: string;
  };
}

interface SendMessagePayload {
  groupId?: string;
  recipientId?: string;
  content: string;
  metadata?: {
    type?: 'text' | 'image' | 'location' | 'meetup_request';
    imageUrl?: string;
    location?: { latitude: number; longitude: number };
  };
}

interface TypingPayload {
  groupId?: string;
  recipientId?: string;
  isTyping: boolean;
}

interface ReadReceiptPayload {
  messageId: string;
  groupId?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly chatService: ChatService,
  ) {}

  afterInit(_server: Server): void {
    // Redis adapter is configured at the application level in main.ts
    this.logger.log('Chat Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    this.logger.log(`Chat client connected: ${client.id}`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.user?.uid;

    if (userId) {
      // Clear typing indicators for this user
      const rooms = await this.redis.smembers(`user:${userId}:rooms`);
      for (const room of rooms) {
        await this.redis.del(`typing:${room}:${userId}`);
        client.to(room).emit('chat:typing', {
          userId,
          roomId: room,
          isTyping: false,
        });
      }
    }

    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId?: string; recipientId?: string },
  ): Promise<{ success: boolean; roomId?: string }> {
    const userId = client.user?.uid;

    if (!userId) {
      return { success: false };
    }

    try {
      const roomId = this.chatService.getRoomId(data.groupId, userId, data.recipientId);

      // Verify user has access to this room
      const hasAccess = await this.chatService.verifyRoomAccess(
        userId,
        data.groupId,
        data.recipientId,
      );

      if (!hasAccess) {
        return { success: false };
      }

      // Join Socket.io room
      await client.join(roomId);

      // Track user's rooms in Redis
      await this.redis.sadd(`user:${userId}:rooms`, roomId);
      await this.redis.sadd(`room:${roomId}:members`, userId);

      this.logger.log(`User ${userId} joined room ${roomId}`);

      return { success: true, roomId };
    } catch (error) {
      this.logger.error(`Join room error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ): Promise<{ success: boolean }> {
    const userId = client.user?.uid;

    if (!userId) {
      return { success: false };
    }

    try {
      await client.leave(data.roomId);
      await this.redis.srem(`user:${userId}:rooms`, data.roomId);
      await this.redis.srem(`room:${data.roomId}:members`, userId);

      // Clear typing indicator
      await this.redis.del(`typing:${data.roomId}:${userId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Leave room error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessagePayload,
  ): Promise<{ success: boolean; messageId?: string; sentAt?: string }> {
    const userId = client.user?.uid;

    if (!userId) {
      return { success: false };
    }

    try {
      const roomId = this.chatService.getRoomId(data.groupId, userId, data.recipientId);

      // Create and cache the message
      const message = await this.chatService.createMessage(
        userId,
        data.content,
        data.groupId,
        data.recipientId,
        data.metadata,
      );

      // Broadcast to room immediately
      this.server.to(roomId).emit('chat:message', {
        id: message.id,
        senderId: userId,
        groupId: data.groupId,
        recipientId: data.recipientId,
        content: data.content,
        metadata: data.metadata,
        sentAt: message.sentAt.toISOString(),
      });

      // Clear sender's typing indicator
      await this.redis.del(`typing:${roomId}:${userId}`);

      return {
        success: true,
        messageId: message.id,
        sentAt: message.sentAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Send message error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingPayload,
  ): Promise<void> {
    const userId = client.user?.uid;

    if (!userId) {
      return;
    }

    const roomId = this.chatService.getRoomId(data.groupId, userId, data.recipientId);

    if (data.isTyping) {
      // Set typing indicator with 5-second TTL
      await this.redis.setex(`typing:${roomId}:${userId}`, 5, '1');
    } else {
      await this.redis.del(`typing:${roomId}:${userId}`);
    }

    // Broadcast typing status to room (except sender)
    client.to(roomId).emit('chat:typing', {
      userId,
      roomId,
      isTyping: data.isTyping,
    });
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:read')
  async handleReadReceipt(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ReadReceiptPayload,
  ): Promise<{ success: boolean }> {
    const userId = client.user?.uid;

    if (!userId) {
      return { success: false };
    }

    try {
      await this.chatService.markMessageAsRead(data.messageId, userId);

      // Broadcast read receipt to room
      if (data.groupId) {
        const roomId = `group:${data.groupId}`;
        this.server.to(roomId).emit('chat:read', {
          messageId: data.messageId,
          userId,
          readAt: new Date().toISOString(),
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Read receipt error: ${(error as Error).message}`);
      return { success: false };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('chat:history')
  async handleGetHistory(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId?: string; recipientId?: string; limit?: number },
  ): Promise<{
    success: boolean;
    messages?: Array<{
      id: string;
      senderId: string;
      content: string;
      sentAt: string;
    }>;
  }> {
    const userId = client.user?.uid;

    if (!userId) {
      return { success: false };
    }

    try {
      const messages = await this.chatService.getRecentMessages(
        data.groupId,
        userId,
        data.recipientId,
        data.limit ?? 50,
      );

      return {
        success: true,
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          sentAt: m.sentAt.toISOString(),
        })),
      };
    } catch (error) {
      this.logger.error(`Get history error: ${(error as Error).message}`);
      return { success: false };
    }
  }
}
