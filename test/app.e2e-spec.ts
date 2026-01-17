import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

// Mock external dependencies
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    auth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
      getUser: jest.fn(),
    }),
  }),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    duplicate: jest.fn().mockReturnThis(),
    geoadd: jest.fn().mockResolvedValue(1),
    geopos: jest.fn().mockResolvedValue([]),
    georadius: jest.fn().mockResolvedValue([]),
    hmset: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    lrange: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    scard: jest.fn().mockResolvedValue(0),
    zrem: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }));
});

describe('AppModule (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Set required environment variables
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USERNAME = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.DB_NAME = 'skimate_test';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.FIREBASE_PROJECT_ID = 'skimate-307c2';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('GET /health should return 200', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
          expect(res.body.uptime).toBeDefined();
        });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', () => {
      return request(app.getHttpServer())
        .get('/some-protected-route')
        .expect(401);
    });

    it('should reject requests with invalid auth header format', () => {
      return request(app.getHttpServer())
        .get('/some-protected-route')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  describe('Strava Webhook', () => {
    it('GET /webhooks/strava should handle challenge', () => {
      return request(app.getHttpServer())
        .get('/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': 'test-challenge-123',
          'hub.verify_token': '', // Will use default empty token
        })
        .expect(401); // Expect unauthorized since token doesn't match
    });

    it('POST /webhooks/strava should accept webhook events', () => {
      return request(app.getHttpServer())
        .post('/webhooks/strava')
        .send({
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'create',
          owner_id: 67890,
          subscription_id: 11111,
          event_time: Date.now(),
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });
});
