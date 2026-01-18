import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Gender, SkillLevel } from '../../../common/enums/index.js';
import { UserPreferences } from './user-preferences.entity.js';
import { SkiSession } from '../../location/entities/ski-session.entity.js';
import { Group } from '../../chat/entities/group.entity.js';

@Entity('users')
export class User {
  @PrimaryColumn('varchar')
  id!: string; // Firebase UID (28 characters)

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({ type: 'enum', enum: Gender })
  gender!: Gender;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: Date;

  @Column({
    name: 'skill_level',
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.BEGINNER,
  })
  skillLevel!: SkillLevel;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => UserPreferences, (prefs) => prefs.user)
  preferences?: UserPreferences;

  @OneToMany(() => SkiSession, (session) => session.user)
  sessions?: SkiSession[];

  @ManyToMany(() => Group, (group) => group.members)
  groups?: Group[];
}
