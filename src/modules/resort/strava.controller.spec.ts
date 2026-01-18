import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { StravaController } from './strava.controller.js';
import { StravaService } from './strava.service.js';

describe('StravaController', () => {
  let controller: StravaController;
  let _stravaService: StravaService;
  let _configService: ConfigService;

  const mockStravaService = {
    handleActivityCreated: jest.fn(),
    handleActivityUpdated: jest.fn(),
    handleActivityDeleted: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set default config values
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'strava.verifyToken') return 'test-verify-token';
      if (key === 'strava.clientSecret') return 'test-client-secret';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StravaController],
      providers: [
        {
          provide: StravaService,
          useValue: mockStravaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<StravaController>(StravaController);
    _stravaService = module.get<StravaService>(StravaService);
    _configService = module.get<ConfigService>(ConfigService);
  });

  describe('handleChallenge (GET /webhooks/strava)', () => {
    it('should respond with hub.challenge for valid subscription request', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'challenge-123',
        'hub.verify_token': 'test-verify-token',
      };

      const result = controller.handleChallenge(query);

      expect(result).toEqual({ 'hub.challenge': 'challenge-123' });
    });

    it('should throw BadRequestException for invalid hub.mode', () => {
      const query = {
        'hub.mode': 'unsubscribe',
        'hub.challenge': 'challenge-123',
        'hub.verify_token': 'test-verify-token',
      };

      expect(() => controller.handleChallenge(query)).toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid verify token', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'challenge-123',
        'hub.verify_token': 'wrong-token',
      };

      expect(() => controller.handleChallenge(query)).toThrow(UnauthorizedException);
    });
  });

  describe('handleWebhook (POST /webhooks/strava)', () => {
    const mockActivityEvent = {
      object_type: 'activity' as const,
      object_id: 12345,
      aspect_type: 'create' as const,
      owner_id: 67890,
      subscription_id: 11111,
      event_time: Date.now(),
    };

    it('should return ok status for activity events', () => {
      const result = controller.handleWebhook(mockActivityEvent);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should process activity create events asynchronously', async () => {
      controller.handleWebhook(mockActivityEvent);

      // Wait for setImmediate to execute
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockStravaService.handleActivityCreated).toHaveBeenCalledWith(
        '67890',
        '12345',
      );
    });

    it('should process activity update events', async () => {
      const updateEvent = {
        ...mockActivityEvent,
        aspect_type: 'update' as const,
        updates: { title: 'Updated Activity' },
      };

      controller.handleWebhook(updateEvent);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockStravaService.handleActivityUpdated).toHaveBeenCalledWith(
        '67890',
        '12345',
        { title: 'Updated Activity' },
      );
    });

    it('should process activity delete events', async () => {
      const deleteEvent = {
        ...mockActivityEvent,
        aspect_type: 'delete' as const,
      };

      controller.handleWebhook(deleteEvent);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockStravaService.handleActivityDeleted).toHaveBeenCalledWith(
        '67890',
        '12345',
      );
    });

    it('should ignore non-activity events', async () => {
      const athleteEvent = {
        ...mockActivityEvent,
        object_type: 'athlete' as const,
      };

      controller.handleWebhook(athleteEvent);
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockStravaService.handleActivityCreated).not.toHaveBeenCalled();
    });

    it('should throw error for invalid signature when secret configured', () => {
      // The signature check happens but with wrong signature
      expect(() =>
        controller.handleWebhook(mockActivityEvent, 'invalid-signature'),
      ).toThrow();
    });
  });
});
