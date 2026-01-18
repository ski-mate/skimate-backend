import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service.js';
import { Message } from './entities/message.entity.js';
import { Group } from './entities/group.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { FriendshipStatus } from '../../common/enums/index.js';

describe('ChatService', () => {
  let service: ChatService;
  let _messageRepository: Repository<Message>;
  let _groupRepository: Repository<Group>;

  const mockRedis = {
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    pipeline: jest.fn().mockReturnValue({
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockMessageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockGroupRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockFriendshipRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: getRepositoryToken(Friendship),
          useValue: mockFriendshipRepository,
        },
        {
          provide: getQueueToken('chat-persistence'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    _messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
    _groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
  });

  describe('getRoomId', () => {
    it('should return group room ID for group chat', () => {
      const roomId = service.getRoomId('group-123', undefined, undefined);
      expect(roomId).toBe('group:group-123');
    });

    it('should return sorted DM room ID for direct messages', () => {
      const roomId1 = service.getRoomId(undefined, 'user-a', 'user-b');
      const roomId2 = service.getRoomId(undefined, 'user-b', 'user-a');

      expect(roomId1).toBe('dm:user-a_user-b');
      expect(roomId2).toBe('dm:user-a_user-b');
    });

    it('should throw error if neither groupId nor recipientId provided', () => {
      expect(() => service.getRoomId(undefined, 'user-1', undefined)).toThrow(
        'Either groupId or recipientId must be provided',
      );
    });
  });

  describe('verifyRoomAccess', () => {
    it('should verify group membership', async () => {
      mockGroupRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'group-123' }),
      });

      const hasAccess = await service.verifyRoomAccess(
        'user-123',
        'group-123',
        undefined,
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false if user not in group', async () => {
      mockGroupRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const hasAccess = await service.verifyRoomAccess(
        'user-123',
        'group-123',
        undefined,
      );

      expect(hasAccess).toBe(false);
    });

    it('should verify friendship for DM', async () => {
      mockFriendshipRepository.findOne.mockResolvedValue({
        userId1: 'user-123',
        userId2: 'user-456',
        status: FriendshipStatus.ACCEPTED,
      });

      const hasAccess = await service.verifyRoomAccess(
        'user-123',
        undefined,
        'user-456',
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false if users are not friends', async () => {
      mockFriendshipRepository.findOne.mockResolvedValue(null);

      const hasAccess = await service.verifyRoomAccess(
        'user-123',
        undefined,
        'user-456',
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe('createMessage', () => {
    it('should create message and cache in Redis', async () => {
      const mockMessage = {
        id: 'msg-123',
        senderId: 'user-123',
        content: 'Hello!',
        groupId: 'group-456',
        sentAt: new Date(),
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);

      const result = await service.createMessage(
        'user-123',
        'Hello!',
        'group-456',
        undefined,
        undefined,
      );

      expect(mockMessageRepository.save).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'chat:group:group-456:messages',
        expect.any(String),
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        'chat:group:group-456:messages',
        0,
        49,
      );
      expect(mockQueue.add).toHaveBeenCalled();
      expect(result.id).toBe('msg-123');
    });
  });

  describe('getRecentMessages', () => {
    it('should return messages from Redis cache', async () => {
      const cachedMessages = [
        JSON.stringify({
          id: 'msg-1',
          senderId: 'user-1',
          content: 'Hello',
          sentAt: new Date().toISOString(),
        }),
        JSON.stringify({
          id: 'msg-2',
          senderId: 'user-2',
          content: 'Hi there',
          sentAt: new Date().toISOString(),
        }),
      ];

      mockRedis.lrange.mockResolvedValue(cachedMessages);

      const result = await service.getRecentMessages(
        'group-123',
        undefined,
        undefined,
        50,
      );

      expect(mockRedis.lrange).toHaveBeenCalledWith(
        'chat:group:group-123:messages',
        0,
        49,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
    });

    it('should fallback to database when cache is empty', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      const dbMessages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          content: 'Hello',
          sentAt: new Date(),
        },
      ];

      mockMessageRepository.createQueryBuilder.mockReturnValue({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(dbMessages),
      });

      await service.getRecentMessages('group-123', undefined, undefined, 50);

      expect(mockMessageRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('markMessageAsRead', () => {
    it('should add userId to readBy array', async () => {
      mockMessageRepository.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      });

      await service.markMessageAsRead('msg-123', 'user-456');

      expect(mockMessageRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('getTypingUsers', () => {
    it('should return list of typing users', async () => {
      mockRedis.keys.mockResolvedValue([
        'typing:group:123:user-1',
        'typing:group:123:user-2',
      ]);

      const result = await service.getTypingUsers('group:123');

      expect(mockRedis.keys).toHaveBeenCalledWith('typing:group:123:*');
      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
    });

    it('should return empty array when no one is typing', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.getTypingUsers('group:123');

      expect(result).toEqual([]);
    });
  });
});
