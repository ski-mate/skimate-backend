import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FriendshipStatus } from '../../../common/enums/index.js';
import { User } from './user.entity.js';

@Entity('friendships')
@Index(['userId1', 'status'])
@Index(['userId2', 'status'])
@Index(['userId1', 'userId2'], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id_1', type: 'uuid' })
  userId1!: string;

  @Column({ name: 'user_id_2', type: 'uuid' })
  userId2!: string;

  @Column({
    type: 'enum',
    enum: FriendshipStatus,
    default: FriendshipStatus.PENDING,
  })
  status!: FriendshipStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id_1' })
  user1?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id_2' })
  user2?: User;
}
