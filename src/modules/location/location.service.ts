import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/index.js';
import { SkiSession } from './entities/ski-session.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';
import { User } from '../users/entities/user.entity.js';
import { FriendshipStatus } from '../../common/enums/index.js';
import type { LocationPing } from '../../proto/location.js';

export interface NearbyFriend {
  friendId: string;
  friendName: string;
  distance: number;
  latitude: number;
  longitude: number;
}

export interface SessionSummary {
  totalVertical: number;
  totalDistance: number;
  maxSpeed: number;
  durationSeconds: number;
}

const LOCATION_TTL_SECONDS = 300; // 5 minutes
const PROXIMITY_RADIUS_METERS = 500;
const GEO_KEY_PREFIX = 'geo:users';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(SkiSession)
    private readonly sessionRepository: Repository<SkiSession>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('location-pings')
    private readonly locationQueue: Queue,
  ) {}

  /**
   * Process incoming GPS ping:
   * 1. Store in Redis for real-time access
   * 2. Find nearby friends
   * 3. Queue for PostgreSQL persistence
   */
  async processLocationPing(
    userId: string,
    ping: LocationPing,
  ): Promise<NearbyFriend[]> {
    const {
      latitude,
      longitude,
      altitude,
      speed,
      accuracy,
      heading,
      timestamp,
      sessionId,
    } = ping;

    // 1. Store current position in Redis Geo Set
    await this.redis.geoadd(GEO_KEY_PREFIX, longitude, latitude, userId);

    // 2. Store full ping data in a hash with TTL
    const pingKey = `location:${userId}`;
    await this.redis.hmset(pingKey, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      altitude: altitude.toString(),
      speed: speed.toString(),
      accuracy: accuracy.toString(),
      heading: heading?.toString() ?? '',
      timestamp: timestamp.toString(),
      sessionId,
    });
    await this.redis.expire(pingKey, LOCATION_TTL_SECONDS);

    // 3. Queue for batch PostgreSQL persistence
    await this.locationQueue.add(
      'persist-ping',
      {
        userId,
        sessionId,
        latitude,
        longitude,
        altitude,
        speed,
        accuracy,
        heading,
        timestamp,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    // 4. Find nearby friends
    const nearbyFriends = await this.findNearbyFriends(
      userId,
      longitude,
      latitude,
    );

    return nearbyFriends;
  }

  /**
   * Find accepted friends within proximity radius using Redis GEORADIUS
   */
  async findNearbyFriends(
    userId: string,
    longitude: number,
    latitude: number,
  ): Promise<NearbyFriend[]> {
    // Get list of accepted friends
    const friendships = await this.friendshipRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user1', 'u1')
      .leftJoinAndSelect('f.user2', 'u2')
      .where(
        '(f.userId1 = :userId OR f.userId2 = :userId) AND f.status = :status',
        { userId, status: FriendshipStatus.ACCEPTED },
      )
      .getMany();

    const friendIds = friendships.map((f) =>
      f.userId1 === userId ? f.userId2 : f.userId1,
    );

    if (friendIds.length === 0) {
      return [];
    }

    // Find nearby users in Redis using GEORADIUS
    const nearbyUsers = await this.redis.georadius(
      GEO_KEY_PREFIX,
      longitude,
      latitude,
      PROXIMITY_RADIUS_METERS,
      'm',
      'WITHDIST',
      'WITHCOORD',
    );

    // Filter to only include friends
    const nearbyFriends: NearbyFriend[] = [];

    for (const result of nearbyUsers) {
      const [memberId, distance, coords] = result as [
        string,
        string,
        [string, string],
      ];

      if (friendIds.includes(memberId) && memberId !== userId) {
        // Get friend's name
        const friend = await this.userRepository.findOne({
          where: { id: memberId },
          select: ['id', 'fullName'],
        });

        if (friend) {
          nearbyFriends.push({
            friendId: memberId,
            friendName: friend.fullName,
            distance: parseFloat(distance),
            latitude: parseFloat(coords[1]),
            longitude: parseFloat(coords[0]),
          });
        }
      }
    }

    return nearbyFriends;
  }

  /**
   * Start a new ski session
   */
  async startSession(userId: string, resortId?: string): Promise<SkiSession> {
    // End any existing active session
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false, endTime: new Date() },
    );

    // Create new session
    const session = this.sessionRepository.create({
      userId,
      resortId,
      startTime: new Date(),
      isActive: true,
    });

    await this.sessionRepository.save(session);
    this.logger.log(`Started session ${session.id} for user ${userId}`);

    return session;
  }

  /**
   * End a ski session and calculate summary
   */
  async endSession(userId: string, sessionId: string): Promise<SessionSummary> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - session.startTime.getTime()) / 1000,
    );

    // Update session
    session.isActive = false;
    session.endTime = endTime;
    await this.sessionRepository.save(session);

    // Remove user from Redis geo set
    await this.redis.zrem(GEO_KEY_PREFIX, userId);
    await this.redis.del(`location:${userId}`);

    this.logger.log(`Ended session ${sessionId} for user ${userId}`);

    return {
      totalVertical: session.totalVertical,
      totalDistance: session.totalDistance,
      maxSpeed: session.maxSpeed,
      durationSeconds,
    };
  }

  /**
   * Handle user disconnect - pause session tracking
   */
  async handleUserDisconnect(userId: string): Promise<void> {
    // Don't end the session, just remove from real-time tracking
    await this.redis.zrem(GEO_KEY_PREFIX, userId);
    this.logger.log(
      `User ${userId} disconnected, removed from real-time tracking`,
    );
  }

  /**
   * Subscribe to friend location updates
   */
  async subscribeToFriends(userId: string, friendIds: string[]): Promise<void> {
    // Store subscription preferences in Redis
    await this.redis.sadd(`subscriptions:${userId}`, ...friendIds);
    await this.redis.expire(`subscriptions:${userId}`, LOCATION_TTL_SECONDS);
  }

  /**
   * Detect which resort a user is currently in using PostGIS
   */
  async detectCurrentResort(
    longitude: number,
    latitude: number,
  ): Promise<string | null> {
    const result = await this.sessionRepository.manager.query<{ id: string }[]>(
      `
      SELECT id FROM resorts
      WHERE ST_Within(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        boundary
      )
      LIMIT 1
    `,
      [longitude, latitude],
    );

    return result[0]?.id ?? null;
  }

  /**
   * Get user's current location from Redis
   */
  async getUserLocation(
    userId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const position = await this.redis.geopos(GEO_KEY_PREFIX, userId);

    if (!position[0]) {
      return null;
    }

    return {
      longitude: parseFloat(position[0][0]),
      latitude: parseFloat(position[0][1]),
    };
  }
}
