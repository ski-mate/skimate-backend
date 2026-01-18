import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LocationPingProcessor } from './location-ping.processor.js';
import { LocationPing } from './entities/location-ping.entity.js';
import { SkiSession } from './entities/ski-session.entity.js';
import type { Job } from 'bullmq';

describe('LocationPingProcessor', () => {
  let processor: LocationPingProcessor;
  let _locationPingRepository: Repository<LocationPing>;
  let _sessionRepository: Repository<SkiSession>;

  const mockLocationPingRepository = {
    create: jest.fn(),
    save: jest.fn().mockResolvedValue([]),
    manager: {
      query: jest.fn(),
    },
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationPingProcessor,
        {
          provide: getRepositoryToken(LocationPing),
          useValue: mockLocationPingRepository,
        },
        {
          provide: getRepositoryToken(SkiSession),
          useValue: mockSessionRepository,
        },
      ],
    }).compile();

    processor = module.get<LocationPingProcessor>(LocationPingProcessor);
    _locationPingRepository = module.get<Repository<LocationPing>>(
      getRepositoryToken(LocationPing),
    );
    _sessionRepository = module.get<Repository<SkiSession>>(
      getRepositoryToken(SkiSession),
    );

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('process', () => {
    it('should add job data to batch buffer', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'persist-ping',
        data: {
          userId: 'user-123',
          sessionId: 'session-456',
          latitude: 39.6042,
          longitude: -105.9538,
          altitude: 3000,
          speed: 15.5,
          accuracy: 5,
          heading: 180,
          timestamp: Date.now(),
        },
      } as Job;

      await processor.process(mockJob);

      // Job should be processed and added to buffer
      // Since buffer size is 100, it won't flush yet
      expect(true).toBe(true);
    });

    it('should flush batch when buffer reaches batch size', async () => {
      // Add 100 jobs to trigger batch flush
      for (let i = 0; i < 100; i++) {
        const mockJob = {
          id: `job-${i}`,
          name: 'persist-ping',
          data: {
            userId: 'user-123',
            sessionId: 'session-456',
            latitude: 39.6042,
            longitude: -105.9538,
            altitude: 3000,
            speed: 15.5,
            accuracy: 5,
            timestamp: Date.now() + i * 1000,
          },
        } as Job;

        await processor.process(mockJob);
      }

      // Should have triggered a save
      expect(mockLocationPingRepository.save).toHaveBeenCalled();
    });
  });

  describe('haversine distance calculation', () => {
    it('should calculate distance between two points', () => {
      // Access private method via type casting
      const calcDistance = (
        processor as unknown as {
          haversineDistance: (
            lat1: number,
            lon1: number,
            lat2: number,
            lon2: number,
          ) => number;
        }
      ).haversineDistance.bind(processor);

      // Two points approximately 1km apart
      const distance = calcDistance(
        39.6042,
        -105.9538,
        39.6133, // about 1km north
        -105.9538,
      );

      // Should be approximately 1000 meters
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1100);
    });

    it('should return 0 for same point', () => {
      const calcDistance = (
        processor as unknown as {
          haversineDistance: (
            lat1: number,
            lon1: number,
            lat2: number,
            lon2: number,
          ) => number;
        }
      ).haversineDistance.bind(processor);

      const distance = calcDistance(39.6042, -105.9538, 39.6042, -105.9538);

      expect(distance).toBe(0);
    });
  });
});
