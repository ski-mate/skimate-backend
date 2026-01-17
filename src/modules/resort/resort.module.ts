import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResortService } from './resort.service.js';
import { StravaController } from './strava.controller.js';
import { StravaService } from './strava.service.js';
import { Resort } from './entities/resort.entity.js';
import { Trail } from './entities/trail.entity.js';
import { Lift } from './entities/lift.entity.js';
import { SkiSession } from '../location/entities/ski-session.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resort, Trail, Lift, SkiSession]),
  ],
  controllers: [StravaController],
  providers: [ResortService, StravaService],
  exports: [ResortService, StravaService],
})
export class ResortModule {}
