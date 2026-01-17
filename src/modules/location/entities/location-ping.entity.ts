import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SkiSession } from './ski-session.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('location_pings')
@Index('idx_location_pings_spatial', { synchronize: false }) // Created via migration with GIST
@Index(['sessionId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class LocationPing {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string; // bigint returns as string in TypeORM

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'user_id', type: 'uuid' }) // Denormalized for faster queries
  userId!: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  coords!: string; // WKT format: "POINT(lon lat)"

  @Column({ type: 'float' })
  altitude!: number; // in meters

  @Column({ type: 'float' })
  speed!: number; // in m/s

  @Column({ type: 'float' })
  accuracy!: number; // in meters

  @Column({ type: 'float', nullable: true })
  heading?: number; // in degrees (0-360)

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => SkiSession, (session) => session.locationPings)
  @JoinColumn({ name: 'session_id' })
  session?: SkiSession;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
