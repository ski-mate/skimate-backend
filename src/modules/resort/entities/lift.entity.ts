import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LiftType, LiftStatus } from '../../../common/enums/index.js';
import { Resort } from './resort.entity.js';

export interface LiftMetadata {
  capacity?: number; // passengers per hour
  rideTime?: number; // in minutes
  verticalRise?: number; // in meters
  length?: number; // in meters
}

@Entity('lifts')
export class Lift {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resort_id', type: 'uuid' })
  resortId!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: LiftType, default: LiftType.CHAIRLIFT })
  type!: LiftType;

  @Column({
    type: 'enum',
    enum: LiftStatus,
    default: LiftStatus.CLOSED,
  })
  status!: LiftStatus;

  @Column({
    type: 'geography',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
  })
  path?: string; // WKT format: "LINESTRING(...)"

  @Column({ type: 'jsonb', nullable: true })
  metadata?: LiftMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Resort, (resort) => resort.lifts)
  @JoinColumn({ name: 'resort_id' })
  resort?: Resort;
}
