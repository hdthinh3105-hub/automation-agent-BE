import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JOBS_QUEUE } from './queue.tokens';

/**
 * TDD Mục 2.6 / Mục 12 — Redis + BullMQ. 1 queue duy nhất `jobs`
 * (gộp từ 4 queue cũ: document-parser/embedding/email/notification):
 * - document.parse / chunks.embed: RAG Pipeline (Ngày 3)
 * - email.send: trả lời khách qua Gmail (Ngày 4 — tách khỏi process
 *   API/polling để không tranh CPU với AI)
 * - notification.send: báo Agent/Admin qua email nội bộ (Ngày 5)
 *
 * Lý do gộp: Upstash free-tier 500k lệnh/tháng — mỗi worker idle vẫn
 * long-poll Redis mỗi `drainDelay` giây, 1 worker rẻ hơn 4 worker nhiều.
 * Retry/backoff cấu hình riêng theo từng job lúc `.add()` (xem các
 * producer), queue chỉ giữ default dọn completed/failed chung.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('queue.redisUrl');

        // `enableReadyCheck: false` bắt buộc cho Upstash (`rediss://`):
        // ioredis mặc định gửi `INFO` trước khi ready, mỗi lần reconnect
        // (Render free hay throttle/chập chờn) là 1 chùm lệnh handshake đổ
        // vào quota 500k/tháng. BullMQ cũng yêu cầu `maxRetriesPerRequest: null`.
        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            },
          };
        }

        return {
          connection: {
            host: configService.get<string>('queue.redisHost', 'localhost'),
            port: configService.get<number>('queue.redisPort', 6379),
            password: configService.get<string>('queue.redisPassword'),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            ...(configService.get<boolean>('queue.redisTls', false) ? { tls: {} } : {}),
          },
        };
      },
    }),

    BullModule.registerQueue({
      name: JOBS_QUEUE,
      defaultJobOptions: {
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
