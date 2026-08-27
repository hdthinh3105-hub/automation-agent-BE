import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { SendNotificationUseCase } from '../use-cases/send-notification.use-case';
import { NotificationChannel } from '../../domain/entities/notification-log.entity';

interface EscalationCreatedPayload {
  escalationId: string;
  ticketId: string;
  reason: string;
}

interface DocumentProcessingFailedPayload {
  documentId: string;
  reason: string;
}

interface SlaBreachedPayload {
  escalationId: string;
  ticketId: string;
}

/**
 * 🎯 Lắng nghe Domain Event cần thông báo Agent/Admin (TDD Mục 5.10):
 * `EscalationCreatedEvent`, `DocumentProcessingFailedEvent`,
 * `SlaBreachedEvent`. Đăng ký ở CẢ `apps/api` (nơi Escalation được tạo)
 * lẫn `apps/worker` (nơi Document Parser/Embedding Worker phát
 * `DocumentProcessingFailedEvent`, và `SlaWatcherService` phát
 * `escalation.sla_breached`) — mỗi process chỉ thấy event nó tự phát
 * (TDD Mục 2.6/12), NotificationModule import ở cả 2 nơi để không bỏ
 * sót thông báo nào.
 */
@Injectable()
export class EscalationNotificationListener {
  private readonly logger = new Logger(EscalationNotificationListener.name);

  constructor(
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('escalation.created')
  async handleEscalationCreated(event: EscalationCreatedPayload): Promise<void> {
    const recipient = this.configService.get<string>('notification.adminEmail');
    if (!recipient) {
      this.logger.warn('ADMIN_NOTIFICATION_EMAIL chưa cấu hình — bỏ qua thông báo escalation.');
      return;
    }
    await this.sendNotificationUseCase.execute({
      type: 'ESCALATION_CREATED',
      recipient,
      channel: NotificationChannel.EMAIL,
      payload: { escalationId: event.escalationId, ticketId: event.ticketId, reason: event.reason },
    });
  }

  @OnEvent('knowledge_base.document_processing_failed')
  async handleDocumentProcessingFailed(event: DocumentProcessingFailedPayload): Promise<void> {
    const recipient = this.configService.get<string>('notification.adminEmail');
    if (!recipient) return;
    await this.sendNotificationUseCase.execute({
      type: 'DOCUMENT_PROCESSING_FAILED',
      recipient,
      channel: NotificationChannel.EMAIL,
      payload: { documentId: event.documentId, reason: event.reason },
    });
  }

  @OnEvent('escalation.sla_breached')
  async handleSlaBreached(event: SlaBreachedPayload): Promise<void> {
    const recipient = this.configService.get<string>('notification.adminEmail');
    if (!recipient) return;
    await this.sendNotificationUseCase.execute({
      type: 'SLA_BREACHED',
      recipient,
      channel: NotificationChannel.EMAIL,
      payload: { escalationId: event.escalationId, ticketId: event.ticketId },
    });
  }
}
