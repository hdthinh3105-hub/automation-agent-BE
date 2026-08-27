import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { AUDIT_LOG_REPOSITORY, IAuditLogRepository } from '../ports/audit-log-repository.port';
import { AuditLog, ActorType } from '../../domain/entities/audit-log.entity';

/**
 * 🎯 `AuditListenerService` (TDD Mục 5.11) — subscribe TẤT CẢ Domain
 * Event qua wildcard listener (`@OnEvent('**')`, đòi hỏi
 * `EventEmitterModule.forRoot({ wildcard: true })` ở Composition Root
 * — xem app.module.ts / worker.module.ts). Audit Module KHÔNG được
 * module khác phụ thuộc ngược lại — chỉ nó tự subscribe (Observer
 * Pattern), nên module này không import Ticket/Escalation/... gì cả.
 *
 * Mỗi Domain Event trong hệ thống đều implement `IDomainEvent` (có sẵn
 * field `eventName`), nên đọc trực tiếp `event.eventName` thay vì dựa
 * vào cơ chế `this`-binding riêng của EventEmitter2 khi wildcard —
 * đáng tin cậy hơn qua các phiên bản thư viện khác nhau.
 */
@Injectable()
export class AuditListenerService {
  private readonly logger = new Logger(AuditListenerService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  @OnEvent('**')
  async handleAny(payload: unknown): Promise<void> {
    const event = payload as Record<string, unknown> & { eventName?: string };
    const name = event?.eventName;
    if (!name) return;

    try {
      const { resourceType, resourceId, actorType, actorId } = this.resolve(name, event);
      const log = AuditLog.create({
        id: uuid(),
        actorType,
        actorId,
        action: name,
        resourceType,
        resourceId,
        changesJson: this.redact(event),
      });
      await this.auditLogRepository.save(log);
    } catch (error) {
      // Audit không bao giờ được làm sập luồng nghiệp vụ chính (TDD Mục
      // 8 — non-fatal, giống PromptLogService).
      this.logger.warn(
        `Failed to record audit log for event "${name}": ${(error as Error).message}`,
      );
    }
  }

  private resolve(
    eventName: string,
    event: Record<string, unknown>,
  ): { resourceType: string; resourceId: string; actorType: ActorType; actorId: string | null } {
    const ticketId = event.ticketId as string | undefined;
    const escalationId = event.escalationId as string | undefined;
    const documentId = event.documentId as string | undefined;
    const userId = event.userId as string | undefined;
    const changedBy = event.changedBy as string | undefined;

    if (eventName.startsWith('ticket.')) {
      return {
        resourceType: 'Ticket',
        resourceId: ticketId ?? 'unknown',
        actorType: this.inferActorType(changedBy),
        actorId: this.inferActorId(changedBy),
      };
    }
    if (eventName.startsWith('escalation.')) {
      return {
        resourceType: 'Escalation',
        resourceId: escalationId ?? 'unknown',
        actorType: ActorType.SYSTEM,
        actorId: null,
      };
    }
    if (eventName.startsWith('knowledge_base.') || eventName.startsWith('rag.')) {
      return {
        resourceType: 'KnowledgeDocument',
        resourceId: documentId ?? 'unknown',
        actorType: ActorType.SYSTEM,
        actorId: null,
      };
    }
    if (eventName.startsWith('identity.')) {
      return {
        resourceType: 'User',
        resourceId: userId ?? 'unknown',
        actorType: ActorType.USER,
        actorId: userId ?? null,
      };
    }
    return {
      resourceType: 'Unknown',
      resourceId: 'unknown',
      actorType: ActorType.SYSTEM,
      actorId: null,
    };
  }

  private inferActorType(changedBy?: string): ActorType {
    if (!changedBy) return ActorType.SYSTEM;
    if (changedBy.startsWith('agent:')) return ActorType.USER;
    if (changedBy.startsWith('system:ai')) return ActorType.AI;
    return ActorType.SYSTEM;
  }

  private inferActorId(changedBy?: string): string | null {
    if (changedBy?.startsWith('agent:')) return changedBy.slice('agent:'.length);
    return null;
  }

  /** Loại field dư thừa trước khi lưu — dữ liệu event vốn không mang PII thô (TDD Mục 10.3). */
  private redact(event: Record<string, unknown>): Record<string, unknown> {
    const { occurredAt: _occurredAt, ...rest } = event;
    return rest;
  }
}
