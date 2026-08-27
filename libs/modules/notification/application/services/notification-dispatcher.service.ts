import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMAIL_SENDER, IEmailSender } from '../../infrastructure/email/nodemailer-email.provider';
import { NotificationChannel } from '../../domain/entities/notification-log.entity';

const NOTIFICATION_SUBJECTS: Record<string, string> = {
  ESCALATION_CREATED: '[AI Support] Ticket cần Agent xử lý',
  DOCUMENT_PROCESSING_FAILED: '[AI Support] Xử lý tài liệu thất bại',
  SLA_BREACHED: '[AI Support] Escalation quá hạn SLA',
};

/**
 * 🎯 `NotificationDispatcherService` (TDD Mục 5.10) — Strategy Pattern
 * theo channel. Đợt Ngày 5 chỉ có EMAIL; WEBHOOK để sẵn interface, chưa
 * implement (Could have, TDD Mục 14.1).
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(@Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender) {}

  async dispatch(
    channel: NotificationChannel,
    type: string,
    recipient: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    if (channel === NotificationChannel.EMAIL) {
      const subject = NOTIFICATION_SUBJECTS[type] ?? `[AI Support] ${type}`;
      const text = this.buildBody(type, payload);
      await this.emailSender.send(recipient, subject, text);
      return;
    }
    this.logger.warn(`Channel "${channel}" chưa được implement — bỏ qua gửi (type=${type}).`);
  }

  private buildBody(type: string, payload: Record<string, unknown> | null): string {
    return `Loại: ${type}\n\nChi tiết:\n${JSON.stringify(payload, null, 2)}`;
  }
}
