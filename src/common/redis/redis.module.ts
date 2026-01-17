import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../../config/configuration.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService<AppConfig, true>): Redis => {
        const logger = new Logger('RedisModule');
        const host = configService.get('redis.host', { infer: true });
        const port = configService.get('redis.port', { infer: true });
        const password = configService.get('redis.password', { infer: true });

        const redis = new Redis({
          host,
          port,
          password: password || undefined,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              logger.error('Redis connection failed after 3 retries');
              return null;
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });

        redis.on('connect', () => {
          logger.log(`Connected to Redis at ${host}:${port}`);
        });

        redis.on('error', (err: Error) => {
          logger.error(`Redis error: ${err.message}`);
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connection...');
    await this.redis.quit();
  }
}
