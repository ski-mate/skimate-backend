import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ResortService } from './resort.service.js';
import { Resort } from './entities/resort.entity.js';
import { Trail } from './entities/trail.entity.js';
import { Lift } from './entities/lift.entity.js';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { LiftStatus, TrailStatus } from '../../common/enums/index.js';

describe('ResortService', () => {
  let service: ResortService;
  let _resortRepository: Repository<Resort>;
  let _trailRepository: Repository<Trail>;
  let _liftRepository: Repository<Lift>;

  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockResortRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTrailRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLiftRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResortService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: getRepositoryToken(Resort),
          useValue: mockResortRepository,
        },
        {
          provide: getRepositoryToken(Trail),
          useValue: mockTrailRepository,
        },
        {
          provide: getRepositoryToken(Lift),
          useValue: mockLiftRepository,
        },
      ],
    }).compile();

    service = module.get<ResortService>(ResortService);
    _resortRepository = module.get<Repository<Resort>>(
      getRepositoryToken(Resort),
    );
    _trailRepository = module.get<Repository<Trail>>(getRepositoryToken(Trail));
    _liftRepository = module.get<Repository<Lift>>(getRepositoryToken(Lift));
  });

  describe('getResort', () => {
    it('should return resort with relations', async () => {
      const mockResort = {
        id: 'resort-123',
        name: 'Keystone',
        trails: [],
        lifts: [],
      };

      mockResortRepository.findOne.mockResolvedValue(mockResort);

      const result = await service.getResort('resort-123');

      expect(mockResortRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'resort-123' },
        relations: ['trails', 'lifts'],
      });
      expect(result.name).toBe('Keystone');
    });

    it('should throw NotFoundException if resort not found', async () => {
      mockResortRepository.findOne.mockResolvedValue(null);

      await expect(service.getResort('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllResorts', () => {
    it('should return all resorts sorted by name', async () => {
      const mockResorts = [
        { id: 'r1', name: 'Aspen' },
        { id: 'r2', name: 'Breckenridge' },
        { id: 'r3', name: 'Keystone' },
      ];

      mockResortRepository.find.mockResolvedValue(mockResorts);

      const result = await service.getAllResorts();

      expect(mockResortRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(3);
    });
  });

  describe('findResortAtLocation', () => {
    it('should find resort containing the point', async () => {
      const mockResort = { id: 'resort-123', name: 'Keystone' };

      mockResortRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockResort),
      });

      const result = await service.findResortAtLocation(-105.9538, 39.6042);

      expect(result).toEqual(mockResort);
    });

    it('should return null if no resort at location', async () => {
      mockResortRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findResortAtLocation(0, 0);

      expect(result).toBeNull();
    });
  });

  describe('getWeather', () => {
    it('should return cached weather data', async () => {
      const mockWeather = {
        temperature: -5,
        feelsLike: -10,
        windSpeed: 20,
        windDirection: 'NW',
        snowDepth: 150,
        visibility: 10,
        conditions: 'Partly cloudy',
        updatedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockWeather));

      const result = await service.getWeather('resort-123');

      expect(mockRedis.get).toHaveBeenCalledWith('weather:resort-123');
      expect(result?.temperature).toBe(-5);
    });

    it('should return null if no cached weather', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getWeather('resort-123');

      expect(result).toBeNull();
    });
  });

  describe('setWeather', () => {
    it('should cache weather data with TTL', async () => {
      const weather = {
        temperature: -5,
        feelsLike: -10,
        windSpeed: 20,
        windDirection: 'NW',
        snowDepth: 150,
        visibility: 10,
        conditions: 'Partly cloudy',
        updatedAt: new Date().toISOString(),
      };

      await service.setWeather('resort-123', weather);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'weather:resort-123',
        900, // 15 minutes
        JSON.stringify(weather),
      );
    });
  });

  describe('getLiftStatuses', () => {
    it('should return cached lift statuses', async () => {
      const mockLifts = [
        { id: 'lift-1', name: 'Summit Express', status: LiftStatus.OPEN },
        { id: 'lift-2', name: 'Outback', status: LiftStatus.CLOSED },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(mockLifts));

      const result = await service.getLiftStatuses('resort-123');

      expect(mockRedis.get).toHaveBeenCalledWith('lift_status:resort-123');
      expect(result).toHaveLength(2);
    });

    it('should fallback to database when cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const dbLifts = [
        { id: 'lift-1', name: 'Summit Express', status: LiftStatus.OPEN },
      ];
      
      mockLiftRepository.find.mockResolvedValue(dbLifts);

      const result = await service.getLiftStatuses('resort-123');

      expect(mockLiftRepository.find).toHaveBeenCalledWith({
        where: { resortId: 'resort-123' },
        order: { name: 'ASC' },
      });
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateLiftStatus', () => {
    it('should update lift status and invalidate cache', async () => {
      const mockLift = {
        id: 'lift-123',
        resortId: 'resort-456',
        name: 'Summit Express',
        status: LiftStatus.CLOSED,
      };

      mockLiftRepository.findOne.mockResolvedValue(mockLift);
      mockLiftRepository.save.mockResolvedValue({
        ...mockLift,
        status: LiftStatus.OPEN,
      });

      const result = await service.updateLiftStatus('lift-123', LiftStatus.OPEN);

      expect(mockLiftRepository.save).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('lift_status:resort-456');
      expect(result.status).toBe(LiftStatus.OPEN);
    });

    it('should throw NotFoundException if lift not found', async () => {
      mockLiftRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateLiftStatus('invalid-id', LiftStatus.OPEN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTrailStatus', () => {
    it('should update trail status', async () => {
      const mockTrail = {
        id: 'trail-123',
        name: 'Schoolmarm',
        status: TrailStatus.OPEN,
      };

      mockTrailRepository.findOne.mockResolvedValue(mockTrail);
      mockTrailRepository.save.mockResolvedValue({
        ...mockTrail,
        status: TrailStatus.GROOMING,
      });

      const result = await service.updateTrailStatus(
        'trail-123',
        TrailStatus.GROOMING,
      );

      expect(mockTrailRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(TrailStatus.GROOMING);
    });

    it('should throw NotFoundException if trail not found', async () => {
      mockTrailRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateTrailStatus('invalid-id', TrailStatus.CLOSED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportTrailsAsGeoJSON', () => {
    it('should export trails as GeoJSON FeatureCollection', async () => {
      const mockTrails = [
        {
          trail_id: 'trail-1',
          trail_name: 'Schoolmarm',
          trail_difficulty: 'Easy',
          trail_status: 'Open',
          geojson: JSON.stringify({
            type: 'LineString',
            coordinates: [
              [-105.95, 39.60],
              [-105.96, 39.61],
            ],
          }),
        },
      ];

      mockTrailRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockTrails),
      });

      const result = await service.exportTrailsAsGeoJSON('resort-123');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.name).toBe('Schoolmarm');
    });
  });
});
