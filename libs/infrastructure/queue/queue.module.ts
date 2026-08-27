import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  DOCUMENT_PARSER_QUEUE,
  EMBEDDING_QUEUE,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
} from './queue.tokens';

/**
 * TDD Mục 2.6 / Mục 12 — Redis + BullMQ. 4 queue:
 * - document-parser / embedding: RAG Pipeline (Ngày 3)
 * - email: trả lời khách qua Gmail SMTP (Ngày 4 — root fix "Connection
 *   timeout", tách khỏi process API/polling để không tranh CPU với AI)
 * - notification: báo Agent/Admin qua email nội bộ (Ngày 5)
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('queue.redisUrl');

        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null,
            },
          };
        }

        return {
          connection: {
            host: configService.get<string>('queue.redisHost', 'localhost'),
            port: configService.get<number>('queue.redisPort', 6379),
            password: configService.get<string>('queue.redisPassword'),
            maxRetriesPerRequest: null,
            ...(configService.get<boolean>('queue.redisTls', false) ? { tls: {} } : {}),
          },
        };
      },
    }),

    BullModule.registerQueue(
      {
        name: DOCUMENT_PARSER_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 100,
          },
          removeOnFail: false,
        },
      },
      {
        name: EMBEDDING_QUEUE,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 100,
          },
          removeOnFail: false,
        },
      },
      {
        name: EMAIL_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10_000,
          },
          removeOnComplete: {
            count: 200,
          },
          removeOnFail: false,
        },
      },
      {
        name: NOTIFICATION_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 10000,
          },
          removeOnComplete: {
            count: 100,
          },
          removeOnFail: false,
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
