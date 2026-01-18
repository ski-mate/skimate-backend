import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { LocationGateway } from './location.gateway.js';
import { LocationService } from './location.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { FirebaseAdminService } from '../auth/firebase-admin.service.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import type { Socket } from 'socket.io';

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

describe('LocationGateway', () => {
  let gateway: LocationGateway;
  let _locationService: LocationService;

  const mockRedis = {
    duplicate: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    scard: jest.fn().mockResolvedValue(0),
    smembers: jest.fn().mockResolvedValue([]),
  };

  const mockLocationService = {
    processLocationPing: jest.fn(),
    startSession: jest.fn(),
    endSession: jest.fn(),
    handleUserDisconnect: jest.fn(),
    subscribeToFriends: jest.fn(),
    getUserLocation: jest.fn(),
  };

  const mockFirebaseAdmin = {
    verifyIdToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationGateway,
        {
          provide: LocationService,
          useValue: mockLocationService,
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

    gateway = module.get<LocationGateway>(LocationGateway);
    _locationService = module.get<LocationService>(LocationService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('handleLocationPing', () => {
    it('should process valid location ping', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const pingData = {
        latitude: 39.6042,
        longitude: -105.9538,
        altitude: 3000,
        speed: 15.5,
        accuracy: 5,
        heading: 180,
        timestamp: Date.now(),
      };

      mockLocationService.processLocationPing.mockResolvedValue([]);

      const result = await gateway.handleLocationPing(mockSocket, pingData);

      expect(mockLocationService.processLocationPing).toHaveBeenCalledWith(
        'user-123',
        pingData,
      );
      expect(result.success).toBe(true);
    });

    it('should reject ping without authenticated user', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: undefined,
      } as unknown as AuthenticatedSocket;

      const pingData = {
        latitude: 39.6042,
        longitude: -105.9538,
        altitude: 3000,
        speed: 15.5,
        accuracy: 5,
        timestamp: Date.now(),
      };

      const result = await gateway.handleLocationPing(mockSocket, pingData);

      expect(result.success).toBe(false);
    });

    it('should throttle rapid pings', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const pingData = {
        latitude: 39.6042,
        longitude: -105.9538,
        altitude: 3000,
        speed: 15.5,
        accuracy: 5,
        timestamp: Date.now(),
      };

      mockLocationService.processLocationPing.mockResolvedValue([]);

      // First ping should succeed
      const result1 = await gateway.handleLocationPing(mockSocket, pingData);
      expect(result1.success).toBe(true);

      // Second ping immediately should be throttled
      const result2 = await gateway.handleLocationPing(mockSocket, pingData);
      expect(result2.success).toBe(false);
      expect(result2.throttled).toBe(true);
    });
  });

  describe('handleSessionStart', () => {
    it('should start a new session', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const mockSession = {
        id: 'session-456',
        userId: 'user-123',
        startTime: new Date(),
        isActive: true,
      };

      mockLocationService.startSession.mockResolvedValue(mockSession);

      const result = await gateway.handleSessionStart(mockSocket, {
        resortId: 'resort-1',
      });

      expect(mockLocationService.startSession).toHaveBeenCalledWith(
        'user-123',
        'resort-1',
      );
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-456');
    });

    it('should fail without authenticated user', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: undefined,
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleSessionStart(mockSocket, {});

      expect(result.success).toBe(false);
    });
  });

  describe('handleSessionEnd', () => {
    it('should end the current session', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const mockSummary = {
        totalVertical: 5000,
        totalDistance: 10000,
        maxSpeed: 45,
        durationSeconds: 7200,
      };

      mockLocationService.endSession.mockResolvedValue(mockSummary);

      const result = await gateway.handleSessionEnd(mockSocket, {
        sessionId: 'session-456',
      });

      expect(mockLocationService.endSession).toHaveBeenCalledWith(
        'user-123',
        'session-456',
      );
      expect(result.success).toBe(true);
      expect(result.summary).toEqual(mockSummary);
    });

    it('should fail without authenticated user', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: undefined,
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleSessionEnd(mockSocket, {
        sessionId: 'session-456',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('handleDisconnect', () => {
    it('should handle user disconnect', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      await gateway.handleDisconnect(mockSocket);

      expect(mockRedis.srem).toHaveBeenCalledWith(
        'connections:user-123',
        'socket-123',
      );
    });

    it('should call handleUserDisconnect when no more connections', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      mockRedis.scard.mockResolvedValue(0);

      await gateway.handleDisconnect(mockSocket);

      expect(mockLocationService.handleUserDisconnect).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('handleSubscribe', () => {
    it('should subscribe to friend location updates', async () => {
      const mockSocket = {
        id: 'socket-123',
        user: { uid: 'user-123' },
      } as unknown as AuthenticatedSocket;

      const result = await gateway.handleSubscribe(mockSocket, {
        friendIds: ['friend-1', 'friend-2'],
      });

      expect(mockLocationService.subscribeToFriends).toHaveBeenCalledWith(
        'user-123',
        ['friend-1', 'friend-2'],
      );
      expect(result.success).toBe(true);
    });
  });
});
