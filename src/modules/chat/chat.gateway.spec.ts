import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { WsAuthGuard } from '../location/guards/ws-auth.guard.js';
import { FirebaseAdminService } from '../auth/firebase-admin.service.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import type { Socket, Server } from 'socket.io';

// Mock the Redis adapter
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(),
}));

interface AuthenticatedSocket extends Socket {
  user?: {
    uid: string;
    email?: string;
  };
}

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let _chatService: ChatService;

  const mockRedis = {
    duplicate: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
  };

  const mockChatService = {
    getRoomId: jest.fn(),
    verifyRoomAccess: jest.fn(),
    createMessage: jest.fn(),
    getRecentMessages: jest.fn(),
    markMessageAsRead: jest.fn(),
    getTypingUsers: jest.fn(),
  };

  const mockFirebaseAdmin = {
    verifyIdToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: FirebaseAdminService,
          useValue: mockFirebaseAdmin,
        },
        WsAuthGuard,
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    _chatService = module.get<ChatService>(ChatService);

    // Mock server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as Server;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('handleJoinRoom', () => {
    it('should join a chat room when user has access', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuthenticatedSocket;

      mockChatService.verifyRoomAccess.mockResolvedValue(true);
      mockChatService.getRoomId.mockReturnValue('group:group-456');

      const result = await gateway.handleJoinRoom(mockSocket, { groupId: 'group-456' });

      expect(mockChatService.verifyRoomAccess).toHaveBeenCalledWith('user-123', 'group-456', undefined);
      expect(mockSocket.join).toHaveBeenCalledWith('group:group-456');
      expect(result.success).toBe(true);
      expect(result.roomId).toBe('group:group-456');
    });

    it('should reject join when user has no access', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
        join: jest.fn(),
      } as unknown as AuthenticatedSocket;

      mockChatService.verifyRoomAccess.mockResolvedValue(false);
      mockChatService.getRoomId.mockReturnValue('group:group-456');

      const result = await gateway.handleJoinRoom(mockSocket, { groupId: 'group-456' });

      expect(result.success).toBe(false);
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should fail without authenticated user', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: undefined,
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleJoinRoom(mockSocket, { groupId: 'group-456' });

      expect(result.success).toBe(false);
    });
  });

  describe('handleSendMessage', () => {
    it('should send message to group', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as AuthenticatedSocket;

      const mockMessage = {
        id: 'msg-123',
        senderId: 'user-123',
        content: 'Hello!',
        sentAt: new Date(),
      };

      mockChatService.getRoomId.mockReturnValue('group:group-456');
      mockChatService.createMessage.mockResolvedValue(mockMessage);

      const result = await gateway.handleSendMessage(mockSocket, {
        groupId: 'group-456',
        content: 'Hello!',
      });

      expect(mockChatService.createMessage).toHaveBeenCalledWith(
        'user-123',
        'Hello!',
        'group-456',
        undefined,
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should fail without authenticated user', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: undefined,
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleSendMessage(mockSocket, {
        groupId: 'group-456',
        content: 'Hello!',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('handleTyping', () => {
    it('should broadcast typing indicator', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as AuthenticatedSocket;

      mockChatService.getRoomId.mockReturnValue('group:group-456');

      await gateway.handleTyping(mockSocket, { groupId: 'group-456', isTyping: true });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'typing:group:group-456:user-123',
        5,
        '1',
      );
      expect(mockSocket.to).toHaveBeenCalledWith('group:group-456');
    });

    it('should remove typing indicator when stopped', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as AuthenticatedSocket;

      mockChatService.getRoomId.mockReturnValue('group:group-456');

      await gateway.handleTyping(mockSocket, { groupId: 'group-456', isTyping: false });

      expect(mockRedis.del).toHaveBeenCalledWith('typing:group:group-456:user-123');
    });
  });

  describe('handleReadReceipt', () => {
    it('should mark message as read', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleReadReceipt(mockSocket, {
        messageId: 'msg-123',
        groupId: 'group-456',
      });

      expect(mockChatService.markMessageAsRead).toHaveBeenCalledWith('msg-123', 'user-123');
      expect(result.success).toBe(true);
    });
  });

  describe('handleGetHistory', () => {
    it('should return message history', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const mockMessages = [
        { id: 'msg-1', senderId: 'user-1', content: 'Hello', sentAt: new Date() },
        { id: 'msg-2', senderId: 'user-2', content: 'Hi', sentAt: new Date() },
      ];

      mockChatService.getRecentMessages.mockResolvedValue(mockMessages);

      const result = await gateway.handleGetHistory(mockSocket, { groupId: 'group-456', limit: 50 });

      expect(mockChatService.getRecentMessages).toHaveBeenCalledWith(
        'group-456',
        'user-123',
        undefined,
        50,
      );
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
    });
  });
});
