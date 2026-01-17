import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { Message, MessageMetadata } from './entities/message.entity.js';
import { Group } from './entities/group.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';
import { FriendshipStatus } from '../../common/enums/index.js';

const MESSAGE_CACHE_SIZE = 50;
const MESSAGE_CACHE_TTL = 3600; // 1 hour

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectQueue('chat-persistence')
    private readonly chatQueue: Queue,
  ) {}

  /**
   * Generate consistent room ID for Socket.io rooms
   */
  getRoomId(groupId?: string, userId1?: string, recipientId?: string): string {
    if (groupId) {
      return `group:${groupId}`;
    }

    if (userId1 && recipientId) {
      // Sort IDs to ensure consistent room name regardless of who initiates
      const sortedIds = [userId1, recipientId].sort();
      return `dm:${sortedIds[0]}_${sortedIds[1]}`;
    }

    throw new Error('Either groupId or recipientId must be provided');
  }

  /**
   * Verify user has access to the chat room
   */
  async verifyRoomAccess(
    userId: string,
    groupId?: string,
    recipientId?: string,
  ): Promise<boolean> {
    if (groupId) {
      // Check if user is a member of the group
      const group = await this.groupRepository
        .createQueryBuilder('group')
        .innerJoin('group.members', 'member')
        .where('group.id = :groupId', { groupId })
        .andWhere('member.id = :userId', { userId })
        .getOne();

      return !!group;
    }

    if (recipientId) {
      // Check if users are friends
      const friendship = await this.friendshipRepository.findOne({
        where: [
          { userId1: userId, userId2: recipientId, status: FriendshipStatus.ACCEPTED },
          { userId1: recipientId, userId2: userId, status: FriendshipStatus.ACCEPTED },
        ],
      });

      return !!friendship;
    }

    return false;
  }

  /**
   * Create a message with write-behind caching
   */
  async createMessage(
    senderId: string,
    content: string,
    groupId?: string,
    recipientId?: string,
    metadata?: MessageMetadata,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      senderId,
      content,
      groupId,
      recipientId,
      metadata,
      sentAt: new Date(),
    });

    // Generate ID before saving
    const savedMessage = await this.messageRepository.save(message);
    const roomId = this.getRoomId(groupId, senderId, recipientId);

    // 1. Push to Redis cache (LPUSH + LTRIM for last 50 messages)
    const cacheKey = `chat:${roomId}:messages`;
    const messageJson = JSON.stringify({
      id: savedMessage.id,
      senderId,
      content,
      metadata,
      sentAt: savedMessage.sentAt.toISOString(),
    });

    await this.redis.lpush(cacheKey, messageJson);
    await this.redis.ltrim(cacheKey, 0, MESSAGE_CACHE_SIZE - 1);
    await this.redis.expire(cacheKey, MESSAGE_CACHE_TTL);

    // 2. Queue for PostgreSQL persistence (already saved above, but could be async)
    await this.chatQueue.add(
      'persist-message',
      {
        id: savedMessage.id,
        senderId,
        content,
        groupId,
        recipientId,
        metadata,
        sentAt: savedMessage.sentAt.toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.debug(`Message ${savedMessage.id} created and cached`);

    return savedMessage;
  }

  /**
   * Get recent messages - first from Redis cache, fallback to PostgreSQL
   */
  async getRecentMessages(
    groupId?: string,
    userId?: string,
    recipientId?: string,
    limit = 50,
  ): Promise<Message[]> {
    const roomId = this.getRoomId(groupId, userId, recipientId);
    const cacheKey = `chat:${roomId}:messages`;

    // Try Redis cache first
    const cachedMessages = await this.redis.lrange(cacheKey, 0, limit - 1);

    if (cachedMessages.length > 0) {
      this.logger.debug(`Returning ${cachedMessages.length} messages from cache`);
      return cachedMessages.map((json) => {
        const data = JSON.parse(json) as {
          id: string;
          senderId: string;
          content: string;
          metadata?: MessageMetadata;
          sentAt: string;
        };
        const msg = new Message();
        msg.id = data.id;
        msg.senderId = data.senderId;
        msg.content = data.content;
        msg.metadata = data.metadata;
        msg.sentAt = new Date(data.sentAt);
        return msg;
      });
    }

    // Fallback to PostgreSQL
    let query = this.messageRepository
      .createQueryBuilder('message')
      .orderBy('message.sentAt', 'DESC')
      .take(limit);

    if (groupId) {
      query = query.where('message.groupId = :groupId', { groupId });
    } else if (userId && recipientId) {
      query = query.where(
        '(message.senderId = :userId AND message.recipientId = :recipientId) OR ' +
          '(message.senderId = :recipientId AND message.recipientId = :userId)',
        { userId, recipientId },
      );
    }

    const messages = await query.getMany();

    // Populate cache for next request
    if (messages.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const msg of messages.reverse()) {
        pipeline.lpush(
          cacheKey,
          JSON.stringify({
            id: msg.id,
            senderId: msg.senderId,
            content: msg.content,
            metadata: msg.metadata,
            sentAt: msg.sentAt.toISOString(),
          }),
        );
      }
      pipeline.ltrim(cacheKey, 0, MESSAGE_CACHE_SIZE - 1);
      pipeline.expire(cacheKey, MESSAGE_CACHE_TTL);
      await pipeline.exec();
    }

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({
        readBy: () => `array_append("read_by", '${userId}')`,
      })
      .where('id = :messageId', { messageId })
      .andWhere('NOT :userId = ANY("read_by")', { userId })
      .execute();
  }

  /**
   * Get users currently typing in a room
   */
  async getTypingUsers(roomId: string): Promise<string[]> {
    const pattern = `typing:${roomId}:*`;
    const keys = await this.redis.keys(pattern);

    return keys.map((key) => key.split(':').pop() ?? '').filter(Boolean);
  }
}
