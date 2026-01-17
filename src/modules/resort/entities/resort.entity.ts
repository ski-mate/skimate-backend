import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Trail } from './trail.entity.js';
import { Lift } from './lift.entity.js';

export interface ResortMetadata {
  website?: string;
  officialStatusUrl?: string;
  timezone?: string;
  country?: string;
  region?: string;
}

@Entity('resorts')
@Index('idx_resorts_spatial', { synchronize: false }) // Created via migration
export class Resort {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'location_name' })
  locationName!: string;

  @Column({ name: 'base_altitude', type: 'float' })
  baseAltitude!: number; // in meters

  @Column({ name: 'summit_altitude', type: 'float' })
  summitAltitude!: number; // in meters

  @Column({ name: 'vertical_drop', type: 'float', nullable: true })
  verticalDrop?: number; // in meters

  @Column({
    type: 'geography',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
  })
  boundary?: string; // WKT format: "POLYGON((...))

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  centerPoint?: string; // WKT format: "POINT(lon lat)"

  @Column({ type: 'jsonb', nullable: true })
  metadata?: ResortMetadata;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => Trail, (trail) => trail.resort)
  trails?: Trail[];

  @OneToMany(() => Lift, (lift) => lift.resort)
  lifts?: Lift[];
}
