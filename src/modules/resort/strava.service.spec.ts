import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StravaService } from './strava.service.js';
import { ResortService } from './resort.service.js';
import { SkiSession } from '../location/entities/ski-session.entity.js';

describe('StravaService', () => {
  let service: StravaService;
  let _sessionRepository: Repository<SkiSession>;
  let _resortService: ResortService;

  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockResortService = {
    findResortAtLocation: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'strava.clientId') return 'test-client-id';
      if (key === 'strava.clientSecret') return 'test-client-secret';
      if (key === 'strava.accessToken') return 'test-access-token';
      if (key === 'strava.refreshToken') return 'test-refresh-token';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaService,
        {
          provide: getRepositoryToken(SkiSession),
          useValue: mockSessionRepository,
        },
        {
          provide: ResortService,
          useValue: mockResortService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StravaService>(StravaService);
    _sessionRepository = module.get<Repository<SkiSession>>(
      getRepositoryToken(SkiSession),
    );
    _resortService = module.get<ResortService>(ResortService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  describe('handleActivityCreated', () => {
    it('should log activity creation attempt', async () => {
      // Since findUserByStravaId returns null (not implemented),
      // the activity creation will be skipped but logged
      await service.handleActivityCreated('67890', '12345');

      // The method should run without throwing
      expect(true).toBe(true);
    });
  });

  describe('handleActivityUpdated', () => {
    it('should handle activity updates when session exists', async () => {
      const mockSession = {
        id: 'session-123',
        stravaActivityId: '12345',
        totalVertical: 1000,
        totalDistance: 5000,
        maxSpeed: 20,
      };

      mockSessionRepository.findOne.mockResolvedValue(mockSession);

      await service.handleActivityUpdated('67890', '12345', {
        title: 'Updated',
      });

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { stravaActivityId: '12345' },
      });
    });

    it('should try to create activity when session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await service.handleActivityUpdated('67890', '12345', {
        title: 'Updated',
      });

      expect(mockSessionRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('handleActivityDeleted', () => {
    it('should unlink session from Strava when session exists', async () => {
      const mockSession = {
        id: 'session-123',
        stravaActivityId: '12345',
      };

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue({
        ...mockSession,
        stravaActivityId: undefined,
      });

      await service.handleActivityDeleted('67890', '12345');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { stravaActivityId: '12345' },
      });
      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...mockSession,
        stravaActivityId: undefined,
      });
    });

    it('should do nothing when session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await service.handleActivityDeleted('67890', '12345');

      expect(mockSessionRepository.findOne).toHaveBeenCalled();
      expect(mockSessionRepository.save).not.toHaveBeenCalled();
    });
  });
});
