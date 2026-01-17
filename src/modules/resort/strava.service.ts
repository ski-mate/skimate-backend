import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SkiSession } from '../location/entities/ski-session.entity.js';
import { ResortService } from './resort.service.js';
import type { AppConfig } from '../../config/configuration.js';

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  max_speed: number;
  average_speed: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: {
    summary_polyline?: string;
  };
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  constructor(
    @InjectRepository(SkiSession)
    private readonly sessionRepository: Repository<SkiSession>,
    private readonly resortService: ResortService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Handle new activity created on Strava
   */
  async handleActivityCreated(
    stravaAthleteId: string,
    activityId: string,
  ): Promise<void> {
    this.logger.log(
      `Processing new Strava activity ${activityId} for athlete ${stravaAthleteId}`,
    );

    try {
      // Find user by Strava athlete ID (would need to store this during OAuth)
      // For now, we skip if we can't find the user
      const user = await this.findUserByStravaId(stravaAthleteId);

      if (!user) {
        this.logger.debug(`No user found for Strava athlete ${stravaAthleteId}`);
        return;
      }

      // Fetch activity details from Strava API
      const activity = await this.fetchActivityFromStrava(activityId);

      if (!activity) {
        this.logger.warn(`Could not fetch activity ${activityId} from Strava`);
        return;
      }

      // Only process ski activities
      if (!this.isSkiActivity(activity)) {
        this.logger.debug(
          `Skipping non-ski activity: ${activity.type} / ${activity.sport_type}`,
        );
        return;
      }

      // Detect resort from start location
      let resortId: string | undefined;
      if (activity.start_latlng) {
        const resort = await this.resortService.findResortAtLocation(
          activity.start_latlng[1], // longitude
          activity.start_latlng[0], // latitude
        );
        resortId = resort?.id;
      }

      // Create ski session from Strava activity
      const session = this.sessionRepository.create({
        userId: user.id,
        resortId,
        totalVertical: activity.total_elevation_gain,
        totalDistance: activity.distance,
        maxSpeed: activity.max_speed,
        startTime: new Date(activity.start_date),
        endTime: new Date(
          new Date(activity.start_date).getTime() + activity.elapsed_time * 1000,
        ),
        isActive: false,
        stravaActivityId: activityId,
        stats: {
          avgSpeed: activity.average_speed,
          timeSkiing: activity.moving_time,
        },
      });

      await this.sessionRepository.save(session);

      this.logger.log(
        `Created ski session ${session.id} from Strava activity ${activityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Strava activity ${activityId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Handle activity updated on Strava
   */
  async handleActivityUpdated(
    stravaAthleteId: string,
    activityId: string,
    updates?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`Strava activity ${activityId} updated: ${JSON.stringify(updates)}`);

    // Find existing session with this Strava activity ID
    const session = await this.sessionRepository.findOne({
      where: { stravaActivityId: activityId },
    });

    if (!session) {
      // Activity wasn't synced, try to create it
      await this.handleActivityCreated(stravaAthleteId, activityId);
      return;
    }

    // Fetch updated activity details
    const activity = await this.fetchActivityFromStrava(activityId);

    if (!activity) {
      return;
    }

    // Update session with new data
    session.totalVertical = activity.total_elevation_gain;
    session.totalDistance = activity.distance;
    session.maxSpeed = activity.max_speed;

    await this.sessionRepository.save(session);

    this.logger.log(`Updated ski session ${session.id} from Strava`);
  }

  /**
   * Handle activity deleted on Strava
   */
  async handleActivityDeleted(
    stravaAthleteId: string,
    activityId: string,
  ): Promise<void> {
    this.logger.log(
      `Strava activity ${activityId} deleted for athlete ${stravaAthleteId}`,
    );

    // Find and soft-delete the session
    const session = await this.sessionRepository.findOne({
      where: { stravaActivityId: activityId },
    });

    if (session) {
      // We don't actually delete - just remove the Strava link
      session.stravaActivityId = undefined;
      await this.sessionRepository.save(session);

      this.logger.log(
        `Unlinked ski session ${session.id} from deleted Strava activity`,
      );
    }
  }

  /**
   * Find user by Strava athlete ID
   * Note: This requires storing Strava athlete ID during OAuth flow
   */
  private async findUserByStravaId(stravaAthleteId: string): Promise<{ id: string } | null> {
    // In a real implementation, you'd have a strava_athlete_id column
    // For now, return null (users would need to be linked via OAuth)
    this.logger.debug(`Looking up user for Strava athlete ${stravaAthleteId}`);
    return null;
  }

  /**
   * Fetch activity details from Strava API
   */
  private async fetchActivityFromStrava(
    activityId: string,
  ): Promise<StravaActivity | null> {
    // Note: In production, this would use the user's access token
    // which would be refreshed using their refresh token
    const accessToken = this.configService.get('strava.accessToken', {
      infer: true,
    });

    if (!accessToken) {
      this.logger.warn('No Strava access token configured');
      return null;
    }

    try {
      const response = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Strava API error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return (await response.json()) as StravaActivity;
    } catch (error) {
      this.logger.error(`Failed to fetch Strava activity: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Check if activity is a skiing activity
   */
  private isSkiActivity(activity: StravaActivity): boolean {
    const skiTypes = [
      'AlpineSki',
      'BackcountrySki',
      'NordicSki',
      'Snowboard',
      'alpine_ski',
      'backcountry_ski',
      'nordic_ski',
      'snowboard',
    ];

    return (
      skiTypes.includes(activity.type) ||
      skiTypes.includes(activity.sport_type)
    );
  }
}
