import { Module } from '@nestjs/common';
import { NOTIFICATION_LOG_REPOSITORY } from './application/ports/notification-log-repository.port';
import { PrismaNotificationLogRepository } from './infrastructure/repositories/prisma-notification-log.repository';
import {
  EMAIL_SENDER,
  NodemailerEmailSender,
} from './infrastructure/email/nodemailer-email.provider';
import { NotificationDispatcherService } from './application/services/notification-dispatcher.service';
import { SendNotificationUseCase } from './application/use-cases/send-notification.use-case';
import { EscalationNotificationListener } from './application/listeners/escalation-notification.listener';

/**
 * TDD Mục 5.10 — Notification Module. Import vào CẢ `apps/api`
 * (`SendNotificationUseCase` để enqueue + listener bắt event tạo ra ở
 * API) lẫn `apps/worker` (`NotificationProcessor`/`NotificationDispatcherService`
 * để thực thi gửi thật, + listener bắt event tạo ra ở Worker).
 */
@Module({
  providers: [
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    { provide: EMAIL_SENDER, useClass: NodemailerEmailSender },
    NotificationDispatcherService,
    SendNotificationUseCase,
    EscalationNotificationListener,
  ],
  exports: [NOTIFICATION_LOG_REPOSITORY, NotificationDispatcherService, SendNotificationUseCase],
})
export class NotificationModule {}
