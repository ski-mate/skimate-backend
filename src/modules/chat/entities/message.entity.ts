import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Group } from './group.entity.js';

export interface MessageMetadata {
  type?: 'text' | 'image' | 'location' | 'meetup_request';
  imageUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  meetupRequestId?: string;
}

@Entity('messages')
@Index(['groupId', 'sentAt'])
@Index(['recipientId', 'senderId', 'sentAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId?: string;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: MessageMetadata;

  @Column({ name: 'read_by', type: 'uuid', array: true, default: [] })
  readBy!: string[];

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender?: User;

  @ManyToOne(() => Group, (group) => group.messages)
  @JoinColumn({ name: 'group_id' })
  group?: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  recipient?: User;
}
