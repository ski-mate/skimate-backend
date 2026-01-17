import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { LocationService } from './location.service.js';
import { SkiSession } from './entities/ski-session.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';
import { User } from '../users/entities/user.entity.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { FriendshipStatus } from '../../common/enums/index.js';
import type { LocationPing } from '../../proto/location.js';

describe('LocationService', () => {
  let service: LocationService;
  let sessionRepository: Repository<SkiSession>;
  let friendshipRepository: Repository<Friendship>;
  let userRepository: Repository<User>;

  const mockRedis = {
    geoadd: jest.fn().mockResolvedValue(1),
    hmset: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    georadius: jest.fn().mockResolvedValue([]),
    geopos: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    manager: {
      query: jest.fn(),
    },
  };

  const mockFriendshipRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: getRepositoryToken(SkiSession),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(Friendship),
          useValue: mockFriendshipRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getQueueToken('location-pings'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    sessionRepository = module.get<Repository<SkiSession>>(
      getRepositoryToken(SkiSession),
    );
    friendshipRepository = module.get<Repository<Friendship>>(
      getRepositoryToken(Friendship),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('processLocationPing', () => {
    const mockPing: LocationPing = {
      userId: 'user-123',
      sessionId: 'session-456',
      latitude: 39.6042,
      longitude: -105.9538,
      altitude: 3000,
      speed: 15.5,
      accuracy: 5,
      heading: 180,
      timestamp: Date.now(),
    };

    it('should store location in Redis', async () => {
      mockFriendshipRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.processLocationPing('user-123', mockPing);

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        'geo:users',
        mockPing.longitude,
        mockPing.latitude,
        'user-123',
      );
    });

    it('should store full ping data in Redis hash', async () => {
      mockFriendshipRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.processLocationPing('user-123', mockPing);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        'location:user-123',
        expect.objectContaining({
          latitude: mockPing.latitude.toString(),
          longitude: mockPing.longitude.toString(),
          altitude: mockPing.altitude.toString(),
        }),
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('location:user-123', 300);
    });

    it('should queue ping for persistence', async () => {
      mockFriendshipRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.processLocationPing('user-123', mockPing);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'persist-ping',
        expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
          latitude: mockPing.latitude,
          longitude: mockPing.longitude,
        }),
        expect.any(Object),
      );
    });
  });

  describe('findNearbyFriends', () => {
    it('should return empty array when user has no friends', async () => {
      mockFriendshipRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findNearbyFriends('user-123', -105.9538, 39.6042);

      expect(result).toEqual([]);
      expect(mockRedis.georadius).not.toHaveBeenCalled();
    });

    it('should find nearby friends using Redis GEORADIUS', async () => {
      const mockFriendships = [
        { userId1: 'user-123', userId2: 'friend-1', status: FriendshipStatus.ACCEPTED },
        { userId1: 'friend-2', userId2: 'user-123', status: FriendshipStatus.ACCEPTED },
      ];

      mockFriendshipRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockFriendships),
      });

      mockRedis.georadius.mockResolvedValue([
        ['friend-1', '100', ['-105.95', '39.60']],
        ['friend-2', '250', ['-105.94', '39.61']],
      ]);

      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: 'friend-1', fullName: 'Friend One' })
        .mockResolvedValueOnce({ id: 'friend-2', fullName: 'Friend Two' });

      const result = await service.findNearbyFriends('user-123', -105.9538, 39.6042);

      expect(mockRedis.georadius).toHaveBeenCalledWith(
        'geo:users',
        -105.9538,
        39.6042,
        500,
        'm',
        'WITHDIST',
        'WITHCOORD',
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        friendId: 'friend-1',
        friendName: 'Friend One',
        distance: 100,
        latitude: 39.60,
        longitude: -105.95,
      });
    });
  });

  describe('startSession', () => {
    it('should end existing active sessions', async () => {
      mockSessionRepository.create.mockReturnValue({
        id: 'new-session',
        userId: 'user-123',
        startTime: new Date(),
        isActive: true,
      });
      mockSessionRepository.save.mockResolvedValue({
        id: 'new-session',
        userId: 'user-123',
        startTime: new Date(),
        isActive: true,
      });

      await service.startSession('user-123', 'resort-1');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isActive: true },
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should create new session', async () => {
      const newSession = {
        id: 'new-session',
        userId: 'user-123',
        resortId: 'resort-1',
        startTime: new Date(),
        isActive: true,
      };

      mockSessionRepository.create.mockReturnValue(newSession);
      mockSessionRepository.save.mockResolvedValue(newSession);

      const result = await service.startSession('user-123', 'resort-1');

      expect(mockSessionRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        resortId: 'resort-1',
        startTime: expect.any(Date),
        isActive: true,
      });
      expect(result).toEqual(newSession);
    });
  });

  describe('endSession', () => {
    it('should throw error if session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.endSession('user-123', 'invalid-session'),
      ).rejects.toThrow('Session not found');
    });

    it('should end session and remove from Redis', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        isActive: true,
        totalVertical: 1000,
        totalDistance: 5000,
        maxSpeed: 25,
      };

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue({
        ...mockSession,
        isActive: false,
        endTime: new Date(),
      });

      const result = await service.endSession('user-123', 'session-123');

      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(mockRedis.zrem).toHaveBeenCalledWith('geo:users', 'user-123');
      expect(mockRedis.del).toHaveBeenCalledWith('location:user-123');
      expect(result.totalVertical).toBe(1000);
      expect(result.totalDistance).toBe(5000);
    });
  });

  describe('getUserLocation', () => {
    it('should return null if user has no location', async () => {
      mockRedis.geopos.mockResolvedValue([null]);

      const result = await service.getUserLocation('user-123');

      expect(result).toBeNull();
    });

    it('should return user location from Redis', async () => {
      mockRedis.geopos.mockResolvedValue([['-105.9538', '39.6042']]);

      const result = await service.getUserLocation('user-123');

      expect(result).toEqual({
        longitude: -105.9538,
        latitude: 39.6042,
      });
    });
  });
});
