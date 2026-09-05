import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE, NotificationJobData } from '@app/infrastructure';
import {
  NOTIFICATION_LOG_REPOSITORY,
  INotificationLogRepository,
  NotificationDispatcherService,
} from '@app/modules/notification';

/**
 * TDD Mục 12 — Email/Notification Worker. Retry: 3 lần, backoff cố định
 * 10s (khai báo ở `QueueModule.registerQueue`).
 *
 * Giữ cùng nhịp idle tiết kiệm Upstash free-tier như các worker khác
 * (drain mặc định 5s/worker ≈ 0.2 lệnh/s ≈ 518k/tháng cho 1 worker).
 */
@Processor(NOTIFICATION_QUEUE, {
  drainDelay: 120,
  stalledInterval: 300_000,
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly notificationLogRepository: INotificationLogRepository,
    private readonly dispatcher: NotificationDispatcherService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { notificationLogId } = job.data;
    const log = await this.notificationLogRepository.findById(notificationLogId);
    if (!log) {
      this.logger.warn(`NotificationLog "${notificationLogId}" not found, skipping.`);
      return;
    }

    try {
      await this.dispatcher.dispatch(log.channel, log.type, log.recipient, log.payload);
      log.markSent();
      await this.notificationLogRepository.save(log);
      this.logger.log(`Đã gửi notification "${log.type}" tới ${log.recipient}`);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        log.markFailed((error as Error).message);
        await this.notificationLogRepository.save(log);
      }
      throw error;
    }
  }
}
