import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LocationGateway } from './location.gateway.js';
import { LocationService } from './location.service.js';
import { LocationPingProcessor } from './location-ping.processor.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { SkiSession } from './entities/ski-session.entity.js';
import { LocationPing } from './entities/location-ping.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkiSession, LocationPing, Friendship, User]),
    BullModule.registerQueue({
      name: 'location-pings',
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  providers: [
    LocationGateway,
    LocationService,
    LocationPingProcessor,
    WsAuthGuard,
  ],
  exports: [LocationService],
})
export class LocationModule {}
