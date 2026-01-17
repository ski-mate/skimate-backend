import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

interface MessageJobData {
  id: string;
  senderId: string;
  content: string;
  groupId?: string;
  recipientId?: string;
  metadata?: Record<string, unknown>;
  sentAt: string;
}

@Processor('chat-persistence')
export class ChatPersistenceProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatPersistenceProcessor.name);

  async process(job: Job<MessageJobData>): Promise<void> {
    // Messages are already persisted in createMessage
    // This processor can be used for additional tasks like:
    // - Sending push notifications
    // - Updating analytics
    // - Triggering webhooks

    this.logger.debug(`Processing message job: ${job.data.id}`);

    // Example: Log for analytics
    // await this.analyticsService.trackMessage(job.data);

    // Example: Send push notification to offline users
    // await this.notificationService.notifyOfflineUsers(job.data);
  }
}
