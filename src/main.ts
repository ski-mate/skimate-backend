import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
      trustProxy: true, // Required for Cloud Run
    }),
  );

  // Enable CORS for mobile clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Configure Redis adapter for Socket.io (horizontal scaling)
  const redisHost = process.env.REDIS_HOST ?? 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;

  const redisIoAdapter = new RedisIoAdapter(
    app,
    redisHost,
    redisPort,
    redisPassword,
  );

  try {
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    logger.log('✅ Redis adapter configured for WebSocket scaling');
  } catch (error) {
    logger.warn(
      `⚠️ Redis adapter connection failed: ${(error as Error).message}. Using default adapter.`,
    );
    // Continue without Redis adapter - single instance mode
  }

  // Global validation pipe with strict settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cloud Run provides PORT environment variable
  const port = process.env.PORT ?? 3000;
  const host = '0.0.0.0'; // Required for Cloud Run

  await app.listen({ port: Number(port), host });
  logger.log(`🚀 SkiMate Backend running on http://${host}:${port}`);
  logger.log(`📊 Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
