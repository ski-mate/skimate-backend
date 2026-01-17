import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Units } from '../../../common/enums/index.js';
import { User } from './user.entity.js';

export interface NotificationSettings {
  friendRequests: boolean;
  proximityAlerts: boolean;
  chatMessages: boolean;
  sosAlerts: boolean;
  weatherAlerts: boolean;
  liftStatusUpdates: boolean;
}

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ name: 'location_sharing_enabled', default: true })
  locationSharingEnabled!: boolean;

  @Column({ type: 'enum', enum: Units, default: Units.METRIC })
  units!: Units;

  @Column({ name: 'notification_settings', type: 'jsonb', default: {} })
  notificationSettings!: NotificationSettings;

  @Column({ name: 'default_proximity_radius', type: 'int', default: 500 })
  defaultProximityRadius!: number; // in meters

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.preferences)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
