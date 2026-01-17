import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Resort } from '../../resort/entities/resort.entity.js';
import { LocationPing } from './location-ping.entity.js';

export interface SessionStats {
  totalRuns?: number;
  longestRun?: number; // in meters
  avgSpeed?: number; // in m/s
  liftRides?: number;
  timeOnLift?: number; // in seconds
  timeSkiing?: number; // in seconds
}

@Entity('ski_sessions')
@Index(['userId', 'startTime'])
export class SkiSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'resort_id', type: 'uuid', nullable: true })
  resortId?: string;

  @Column({ name: 'total_vertical', type: 'float', default: 0 })
  totalVertical!: number; // in meters

  @Column({ name: 'total_distance', type: 'float', default: 0 })
  totalDistance!: number; // in meters

  @Column({ name: 'max_speed', type: 'float', default: 0 })
  maxSpeed!: number; // in m/s

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime?: Date;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  stats?: SessionStats;

  @Column({ name: 'strava_activity_id', nullable: true })
  stravaActivityId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Resort)
  @JoinColumn({ name: 'resort_id' })
  resort?: Resort;

  @OneToMany(() => LocationPing, (ping) => ping.session)
  locationPings?: LocationPing[];
}
