import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChatPersistenceProcessor } from './chat-persistence.processor.js';
import type { Job } from 'bullmq';

describe('ChatPersistenceProcessor', () => {
  let processor: ChatPersistenceProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatPersistenceProcessor],
    }).compile();

    processor = module.get<ChatPersistenceProcessor>(ChatPersistenceProcessor);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  describe('process', () => {
    it('should process group message job', () => {
      const mockJob = {
        id: 'job-123',
        name: 'persist-message',
        data: {
          id: 'msg-123',
          senderId: 'user-123',
          content: 'Hello, world!',
          groupId: 'group-456',
          sentAt: new Date().toISOString(),
        },
      } as Job;

      // Should complete without throwing (process is now sync)
      expect(() => processor.process(mockJob)).not.toThrow();
    });

    it('should process DM message job', () => {
      const mockJob = {
        id: 'job-125',
        name: 'persist-message',
        data: {
          id: 'msg-dm',
          senderId: 'user-123',
          content: 'Direct message',
          recipientId: 'user-456',
          sentAt: new Date().toISOString(),
        },
      } as Job;

      expect(() => processor.process(mockJob)).not.toThrow();
    });

    it('should process message with metadata', () => {
      const mockJob = {
        id: 'job-126',
        name: 'persist-message',
        data: {
          id: 'msg-with-meta',
          senderId: 'user-123',
          content: 'Location share',
          groupId: 'group-456',
          metadata: {
            type: 'location',
            latitude: 39.6042,
            longitude: -105.9538,
          },
          sentAt: new Date().toISOString(),
        },
      } as Job;

      expect(() => processor.process(mockJob)).not.toThrow();
    });
  });
});
