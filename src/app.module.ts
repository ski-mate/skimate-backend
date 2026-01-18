import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';

import configuration, { type AppConfig } from './config/configuration.js';
import { RedisModule } from './common/redis/index.js';
import { FirebaseAuthGuard } from './common/guards/index.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ResortModule } from './modules/resort/resort.module.js';
import { DocsModule } from './modules/docs/docs.module.js';

// Entities
import {
  User,
  UserPreferences,
  Friendship,
} from './modules/users/entities/index.js';
import { Group, Message } from './modules/chat/entities/index.js';
import { Resort, Trail, Lift } from './modules/resort/entities/index.js';
import { SkiSession, LocationPing } from './modules/location/entities/index.js';

const entities = [
  User,
  UserPreferences,
  Friendship,
  Group,
  Message,
  Resort,
  Trail,
  Lift,
  SkiSession,
  LocationPing,
];

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // TypeORM with PostgreSQL/PostGIS
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        host: configService.get('database.host', { infer: true }),
        port: configService.get('database.port', { infer: true }),
        username: configService.get('database.username', { infer: true }),
        password: configService.get('database.password', { infer: true }),
        database: configService.get('database.name', { infer: true }),
        entities,
        synchronize: false, // NEVER true in production - use migrations
        logging:
          configService.get('nodeEnv', { infer: true }) === 'development',
        ssl:
          configService.get('nodeEnv', { infer: true }) === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    // BullMQ for background jobs
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        connection: {
          host: configService.get('redis.host', { infer: true }),
          port: configService.get('redis.port', { infer: true }),
          password:
            configService.get('redis.password', { infer: true }) || undefined,
        },
      }),
    }),

    // Redis Module
    RedisModule,

    // Auth Module (Firebase)
    AuthModule,

    // Health Check Module
    HealthModule,

    // Location Tracking Module
    LocationModule,

    // Chat & Messaging Module
    ChatModule,

    // Resort Integration Module
    ResortModule,

    // API Documentation Module
    DocsModule,
  ],
  providers: [
    // Global Firebase Auth Guard
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {}
