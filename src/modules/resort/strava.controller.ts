import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Public } from '../../common/decorators/index.js';
import { StravaService } from './strava.service.js';
import type { AppConfig } from '../../config/configuration.js';

interface StravaWebhookChallenge {
  'hub.mode': string;
  'hub.challenge': string;
  'hub.verify_token': string;
}

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}

@Controller('webhooks/strava')
export class StravaController {
  private readonly logger = new Logger(StravaController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly stravaService: StravaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    // Use a simple verify token for webhook registration
    this.verifyToken = 'skimate-strava-webhook';
  }

  /**
   * Handle Strava webhook subscription validation (GET request)
   * Strava sends this when registering a new webhook subscription
   */
  @Get()
  @Public()
  handleChallenge(
    @Query() query: StravaWebhookChallenge,
  ): { 'hub.challenge': string } {
    this.logger.log('Received Strava webhook challenge');

    if (query['hub.mode'] !== 'subscribe') {
      throw new BadRequestException('Invalid hub.mode');
    }

    if (query['hub.verify_token'] !== this.verifyToken) {
      throw new UnauthorizedException('Invalid verify token');
    }

    // Must respond within 2 seconds with the challenge
    return { 'hub.challenge': query['hub.challenge'] };
  }

  /**
   * Handle Strava webhook events (POST request)
   * Called when activities are created, updated, or deleted
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() event: StravaWebhookEvent,
    @Headers('x-hub-signature') signature?: string,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received Strava webhook: ${event.object_type} ${event.aspect_type} ${event.object_id}`,
    );

    // Verify webhook signature if provided
    if (signature) {
      const isValid = this.verifySignature(event, signature);
      if (!isValid) {
        this.logger.warn('Invalid Strava webhook signature');
        throw new UnauthorizedException('Invalid signature');
      }
    }

    // Process the event asynchronously (don't block the response)
    // Must respond within 2 seconds
    setImmediate(() => {
      this.processEvent(event).catch((error) => {
        this.logger.error(`Failed to process Strava event: ${error.message}`);
      });
    });

    return { status: 'ok' };
  }

  /**
   * Verify the webhook signature using HMAC
   */
  private verifySignature(
    event: StravaWebhookEvent,
    signature: string,
  ): boolean {
    const clientSecret = this.configService.get('strava.clientSecret', {
      infer: true,
    });

    if (!clientSecret) {
      this.logger.warn('Strava client secret not configured');
      return true; // Skip validation if not configured
    }

    const body = JSON.stringify(event);
    const expectedSignature = createHmac('sha256', clientSecret)
      .update(body)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  /**
   * Process the Strava event
   */
  private async processEvent(event: StravaWebhookEvent): Promise<void> {
    // Only process activity events
    if (event.object_type !== 'activity') {
      this.logger.debug(`Ignoring non-activity event: ${event.object_type}`);
      return;
    }

    switch (event.aspect_type) {
      case 'create':
        await this.stravaService.handleActivityCreated(
          event.owner_id.toString(),
          event.object_id.toString(),
        );
        break;

      case 'update':
        await this.stravaService.handleActivityUpdated(
          event.owner_id.toString(),
          event.object_id.toString(),
          event.updates,
        );
        break;

      case 'delete':
        await this.stravaService.handleActivityDeleted(
          event.owner_id.toString(),
          event.object_id.toString(),
        );
        break;

      default:
        this.logger.debug(`Unknown aspect type: ${event.aspect_type}`);
    }
  }
}
