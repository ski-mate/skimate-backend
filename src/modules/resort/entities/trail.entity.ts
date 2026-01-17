import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TrailDifficulty, TrailStatus } from '../../../common/enums/index.js';
import { Resort } from './resort.entity.js';

export interface TrailMetadata {
  length?: number; // in meters
  verticalDrop?: number; // in meters
  averageGrade?: number; // percentage
  maxGrade?: number; // percentage
  groomed?: boolean;
  snowmaking?: boolean;
}

@Entity('trails')
@Index('idx_trails_spatial', { synchronize: false }) // Created via migration
export class Trail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resort_id', type: 'uuid' })
  resortId!: string;

  @Column()
  name!: string;

  @Column({
    type: 'enum',
    enum: TrailDifficulty,
    default: TrailDifficulty.INTERMEDIATE,
  })
  difficulty!: TrailDifficulty;

  @Column({
    type: 'geography',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
  })
  path?: string; // WKT format: "LINESTRING(...)"

  @Column({
    type: 'enum',
    enum: TrailStatus,
    default: TrailStatus.OPEN,
  })
  status!: TrailStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: TrailMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Resort, (resort) => resort.trails)
  @JoinColumn({ name: 'resort_id' })
  resort?: Resort;
}
