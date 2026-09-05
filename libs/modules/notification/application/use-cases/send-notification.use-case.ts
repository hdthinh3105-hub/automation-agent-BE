import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { JOBS_QUEUE, JOB_SEND_NOTIFICATION, NotificationJobData } from '@app/infrastructure';
import {
  NOTIFICATION_LOG_REPOSITORY,
  INotificationLogRepository,
} from '../ports/notification-log-repository.port';
import {
  NotificationLog,
  NotificationChannel,
} from '../../domain/entities/notification-log.entity';

export interface SendNotificationCommand {
  type: string;
  recipient: string;
  channel: NotificationChannel;
  payload?: Record<string, unknown>;
}

/**
 * 🎯 Use Case — tạo `NotificationLog(status=QUEUED)` rồi enqueue job cho
 * Notification/Email Worker thực thi gửi thật (TDD Mục 5.10/12: "Email
 * Worker thực thi gửi thực tế qua Queue, không gửi đồng bộ trong
 * request"). Enqueue qua Redis (BullMQ) nên hoạt động XUYÊN QUA process
 * boundary: dù `SendNotificationUseCase` chạy ở `apps/api`, job vẫn
 * được `JobsProcessor` ở `apps/worker` nhặt lên xử lý.
 */
@Injectable()
export class SendNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly notificationLogRepository: INotificationLogRepository,
    @InjectQueue(JOBS_QUEUE) private readonly notificationQueue: Queue<NotificationJobData>,
  ) {}

  async execute(command: SendNotificationCommand): Promise<void> {
    const log = NotificationLog.create({
      id: uuid(),
      type: command.type,
      recipient: command.recipient,
      channel: command.channel,
      payload: command.payload,
    });
    await this.notificationLogRepository.save(log);
    await this.notificationQueue.add(
      JOB_SEND_NOTIFICATION,
      { notificationLogId: log.id },
      // Giữ nguyên semantics cũ của queue notification: retry 3 lần,
      // backoff cố định 10s (trước đây khai báo ở QueueModule).
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );
  }
}
