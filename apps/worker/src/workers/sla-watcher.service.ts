import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ESCALATION_REPOSITORY,
  IEscalationRepository,
  EscalationStatus,
} from '@app/modules/escalation';

/**
 * SLA Watcher Worker (TDD Mục 12, Should have) — quét mỗi 5 phút các
 * Escalation đang PENDING quá hạn `slaDeadline`, phát
 * `escalation.sla_breached` để Notification Module (import cùng
 * `apps/worker`) báo Admin.
 *
 * Giới hạn đã biết (TDD Mục 17): chưa có cờ "đã thông báo" trên
 * Escalation, nên nếu ticket vẫn PENDING qua nhiều chu kỳ quét, thông
 * báo có thể lặp lại mỗi 5 phút cho tới khi Agent Acknowledge. Chấp
 * nhận đánh đổi này cho phạm vi 7 ngày — hướng cải tiến: thêm cột
 * `slaBreachNotifiedAt` để chỉ báo đúng 1 lần.
 */
@Injectable()
export class SlaWatcherService {
  private readonly logger = new Logger(SlaWatcherService.name);

  constructor(
    @Inject(ESCALATION_REPOSITORY) private readonly escalationRepository: IEscalationRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSlaBreaches(): Promise<void> {
    const { items } = await this.escalationRepository.list({
      status: EscalationStatus.PENDING,
      page: 1,
      limit: 100,
    });
    const now = Date.now();
    const breached = items.filter((e) => e.slaDeadline.getTime() < now);

    for (const escalation of breached) {
      this.eventEmitter.emit('escalation.sla_breached', {
        eventName: 'escalation.sla_breached',
        occurredAt: new Date(),
        escalationId: escalation.id,
        ticketId: escalation.ticketId,
      });
    }
    if (breached.length > 0) {
      this.logger.warn(`Phát hiện ${breached.length} escalation quá hạn SLA.`);
    }
  }
}
