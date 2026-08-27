import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ITicketRepository, TICKET_REPOSITORY, TicketStatus } from '@app/modules/ticket';
import { ESCALATION_REPOSITORY, IEscalationRepository } from '../ports/escalation-repository.port';
import { EscalationNotFoundException } from '../../domain/exceptions/escalation.exception';
import { EscalationResponseDto } from '../dto/escalation.dto';

/**
 * 🎯 Use Case — Agent đánh dấu Escalation đã xử lý xong (TDD Mục 9:
 * IN_PROGRESS -> RESOLVED). Đồng bộ cả Ticket sang RESOLVED nếu ticket
 * đang IN_PROGRESS (giữ 2 aggregate nhất quán mà không cần Saga phức
 * tạp — TDD Mục 8: "không có side-effect cần rollback phức tạp").
 */
@Injectable()
export class ResolveEscalationUseCase {
  constructor(
    @Inject(ESCALATION_REPOSITORY) private readonly escalationRepository: IEscalationRepository,
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(escalationId: string, resolutionNote?: string): Promise<EscalationResponseDto> {
    const escalation = await this.escalationRepository.findById(escalationId);
    if (!escalation) {
      throw new EscalationNotFoundException(escalationId);
    }

    escalation.resolve(resolutionNote);
    await this.escalationRepository.save(escalation);

    const ticket = await this.ticketRepository.findById(escalation.ticketId);
    if (ticket && ticket.status === TicketStatus.IN_PROGRESS) {
      ticket.transitionTo(TicketStatus.RESOLVED, 'system:escalation_resolved', resolutionNote);
      await this.ticketRepository.save(ticket);
      for (const event of ticket.domainEvents) {
        this.eventEmitter.emit(event.eventName, event);
      }
      ticket.clearDomainEvents();
    }

    for (const event of escalation.domainEvents) {
      this.eventEmitter.emit(event.eventName, event);
    }
    escalation.clearDomainEvents();

    return {
      id: escalation.id,
      ticketId: escalation.ticketId,
      reason: escalation.reason,
      assignedAgentId: escalation.assignedAgentId,
      slaDeadline: escalation.slaDeadline,
      status: escalation.status,
      resolutionNote: escalation.resolutionNote,
      createdAt: escalation.createdAt,
      acknowledgedAt: escalation.acknowledgedAt,
      resolvedAt: escalation.resolvedAt,
    };
  }
}
