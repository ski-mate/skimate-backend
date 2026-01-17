import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { Resort } from './entities/resort.entity.js';
import { Trail } from './entities/trail.entity.js';
import { Lift } from './entities/lift.entity.js';
import { TrailStatus, LiftStatus } from '../../common/enums/index.js';

const WEATHER_CACHE_TTL = 900; // 15 minutes
const LIFT_STATUS_CACHE_TTL = 600; // 10 minutes

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  windDirection: string;
  snowDepth: number;
  visibility: number;
  conditions: string;
  updatedAt: string;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

@Injectable()
export class ResortService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Resort)
    private readonly resortRepository: Repository<Resort>,
    @InjectRepository(Trail)
    private readonly trailRepository: Repository<Trail>,
    @InjectRepository(Lift)
    private readonly liftRepository: Repository<Lift>,
  ) {}

  /**
   * Get resort by ID with trails and lifts
   */
  async getResort(resortId: string): Promise<Resort> {
    const resort = await this.resortRepository.findOne({
      where: { id: resortId },
      relations: ['trails', 'lifts'],
    });

    if (!resort) {
      throw new NotFoundException('Resort not found');
    }

    return resort;
  }

  /**
   * Get all resorts
   */
  async getAllResorts(): Promise<Resort[]> {
    return this.resortRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Find resort containing a point (geofencing)
   */
  async findResortAtLocation(
    longitude: number,
    latitude: number,
  ): Promise<Resort | null> {
    const result = await this.resortRepository
      .createQueryBuilder('resort')
      .where(
        `ST_Within(
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
          resort.boundary
        )`,
        { longitude, latitude },
      )
      .getOne();

    return result;
  }

  /**
   * Get weather data for resort (from Redis cache)
   */
  async getWeather(resortId: string): Promise<WeatherData | null> {
    const cacheKey = `weather:${resortId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as WeatherData;
    }

    return null;
  }

  /**
   * Store weather data in cache
   */
  async setWeather(resortId: string, weather: WeatherData): Promise<void> {
    const cacheKey = `weather:${resortId}`;
    await this.redis.setex(cacheKey, WEATHER_CACHE_TTL, JSON.stringify(weather));
  }

  /**
   * Get lift statuses for resort (from Redis cache first, then DB)
   */
  async getLiftStatuses(resortId: string): Promise<Lift[]> {
    const cacheKey = `lift_status:${resortId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Lift[];
    }

    // Fallback to database
    const lifts = await this.liftRepository.find({
      where: { resortId },
      order: { name: 'ASC' },
    });

    // Cache for next request
    await this.redis.setex(cacheKey, LIFT_STATUS_CACHE_TTL, JSON.stringify(lifts));

    return lifts;
  }

  /**
   * Update lift status
   */
  async updateLiftStatus(
    liftId: string,
    status: LiftStatus,
  ): Promise<Lift> {
    const lift = await this.liftRepository.findOne({ where: { id: liftId } });

    if (!lift) {
      throw new NotFoundException('Lift not found');
    }

    lift.status = status;
    lift.updatedAt = new Date();
    await this.liftRepository.save(lift);

    // Invalidate cache
    await this.redis.del(`lift_status:${lift.resortId}`);

    return lift;
  }

  /**
   * Bulk update lift statuses
   */
  async bulkUpdateLiftStatuses(
    updates: Array<{ liftId: string; status: LiftStatus }>,
  ): Promise<void> {
    const resortIds = new Set<string>();

    for (const update of updates) {
      await this.liftRepository.update(update.liftId, {
        status: update.status,
        updatedAt: new Date(),
      });

      const lift = await this.liftRepository.findOne({
        where: { id: update.liftId },
        select: ['resortId'],
      });

      if (lift) {
        resortIds.add(lift.resortId);
      }
    }

    // Invalidate caches for affected resorts
    for (const resortId of resortIds) {
      await this.redis.del(`lift_status:${resortId}`);
    }
  }

  /**
   * Update trail status
   */
  async updateTrailStatus(
    trailId: string,
    status: TrailStatus,
  ): Promise<Trail> {
    const trail = await this.trailRepository.findOne({ where: { id: trailId } });

    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    trail.status = status;
    await this.trailRepository.save(trail);

    return trail;
  }

  /**
   * Convert trails to GeoJSON FeatureCollection for Mapbox
   */
  async exportTrailsAsGeoJSON(resortId: string): Promise<GeoJSONFeatureCollection> {
    const trails = await this.trailRepository
      .createQueryBuilder('trail')
      .select([
        'trail.id',
        'trail.name',
        'trail.difficulty',
        'trail.status',
        'ST_AsGeoJSON(trail.path) as geojson',
      ])
      .where('trail.resortId = :resortId', { resortId })
      .getRawMany<{
        trail_id: string;
        trail_name: string;
        trail_difficulty: string;
        trail_status: string;
        geojson: string;
      }>();

    const features: GeoJSONFeature[] = trails
      .filter((t) => t.geojson)
      .map((trail) => ({
        type: 'Feature' as const,
        properties: {
          id: trail.trail_id,
          name: trail.trail_name,
          difficulty: trail.trail_difficulty,
          status: trail.trail_status,
        },
        geometry: JSON.parse(trail.geojson) as {
          type: string;
          coordinates: number[][];
        },
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Export resort boundary as GeoJSON
   */
  async exportResortBoundaryAsGeoJSON(
    resortId: string,
  ): Promise<GeoJSONFeature | null> {
    const result = await this.resortRepository
      .createQueryBuilder('resort')
      .select([
        'resort.id',
        'resort.name',
        'ST_AsGeoJSON(resort.boundary) as geojson',
      ])
      .where('resort.id = :resortId', { resortId })
      .getRawOne<{
        resort_id: string;
        resort_name: string;
        geojson: string;
      }>();

    if (!result?.geojson) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {
        id: result.resort_id,
        name: result.resort_name,
      },
      geometry: JSON.parse(result.geojson) as {
        type: string;
        coordinates: number[][][];
      },
    };
  }

  /**
   * Find nearest trail to a point
   */
  async findNearestTrail(
    resortId: string,
    longitude: number,
    latitude: number,
  ): Promise<Trail | null> {
    const result = await this.trailRepository
      .createQueryBuilder('trail')
      .addSelect(
        `ST_Distance(
          trail.path,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        )`,
        'distance',
      )
      .where('trail.resortId = :resortId', { resortId })
      .orderBy('distance', 'ASC')
      .setParameters({ longitude, latitude })
      .getOne();

    return result;
  }
}
