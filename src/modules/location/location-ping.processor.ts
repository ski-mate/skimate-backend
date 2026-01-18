import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bullmq';
import { LocationPing } from './entities/location-ping.entity.js';
import { SkiSession } from './entities/ski-session.entity.js';

interface LocationPingJobData {
  userId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  accuracy: number;
  heading?: number;
  timestamp: number;
}

@Processor('location-pings')
export class LocationPingProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationPingProcessor.name);
  private readonly batchBuffer: LocationPingJobData[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;
  constructor(
    @InjectRepository(LocationPing)
    private readonly locationPingRepository: Repository<LocationPing>,
    @InjectRepository(SkiSession)
    private readonly sessionRepository: Repository<SkiSession>,
  ) {
    super();
    this.startFlushTimer();
  }

  async process(job: Job<LocationPingJobData>): Promise<void> {
    this.batchBuffer.push(job.data);

    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }
  }

  private startFlushTimer(): void {
    setInterval(() => {
      if (this.batchBuffer.length > 0) {
        this.flushBatch().catch((err: Error) => {
          this.logger.error(`Flush timer error: ${err.message}`);
        });
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) {
      return;
    }

    const batch = this.batchBuffer.splice(0, this.BATCH_SIZE);

    try {
      // Convert to entities with WKT Point format
      const entities = batch.map((data) => {
        const ping = new LocationPing();
        ping.userId = data.userId;
        ping.sessionId = data.sessionId;
        ping.coords = `POINT(${data.longitude} ${data.latitude})`;
        ping.altitude = data.altitude;
        ping.speed = data.speed;
        ping.accuracy = data.accuracy;
        ping.heading = data.heading;
        ping.createdAt = new Date(data.timestamp);
        return ping;
      });

      // Batch insert
      await this.locationPingRepository.save(entities);

      // Update session stats for each unique session
      const sessionIds = [...new Set(batch.map((d) => d.sessionId))];

      for (const sessionId of sessionIds) {
        const sessionPings = batch.filter((d) => d.sessionId === sessionId);
        await this.updateSessionStats(sessionId, sessionPings);
      }

      this.logger.debug(`Persisted batch of ${entities.length} location pings`);
    } catch (error) {
      this.logger.error(`Failed to persist batch: ${(error as Error).message}`);

      // Re-add failed items to buffer for retry
      this.batchBuffer.unshift(...batch);
    }
  }

  private async updateSessionStats(
    sessionId: string,
    pings: LocationPingJobData[],
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return;
    }

    // Calculate stats from new pings
    let additionalDistance = 0;
    let maxSpeed = session.maxSpeed;
    let verticalDescent = 0;

    for (let i = 1; i < pings.length; i++) {
      const prev = pings[i - 1];
      const curr = pings[i];

      // Calculate distance using Haversine formula
      additionalDistance += this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );

      // Track max speed
      if (curr.speed > maxSpeed) {
        maxSpeed = curr.speed;
      }

      // Track vertical descent (only count downhill)
      if (curr.altitude < prev.altitude) {
        verticalDescent += prev.altitude - curr.altitude;
      }
    }

    // Update session
    await this.sessionRepository.update(sessionId, {
      totalDistance: session.totalDistance + additionalDistance,
      totalVertical: session.totalVertical + verticalDescent,
      maxSpeed,
    });
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
