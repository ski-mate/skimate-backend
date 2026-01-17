import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { GroupService } from './group.service.js';
import { ChatPersistenceProcessor } from './chat-persistence.processor.js';
import { Message } from './entities/message.entity.js';
import { Group } from './entities/group.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Friendship } from '../users/entities/friendship.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Group, User, Friendship]),
    BullModule.registerQueue({
      name: 'chat-persistence',
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  providers: [
    ChatGateway,
    ChatService,
    GroupService,
    ChatPersistenceProcessor,
  ],
  exports: [ChatService, GroupService],
})
export class ChatModule {}
