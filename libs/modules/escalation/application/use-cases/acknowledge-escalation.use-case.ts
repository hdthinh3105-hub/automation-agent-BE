import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ITicketRepository, TICKET_REPOSITORY, TicketStatus } from '@app/modules/ticket';
import { ESCALATION_REPOSITORY, IEscalationRepository } from '../ports/escalation-repository.port';
import { EscalationNotFoundException } from '../../domain/exceptions/escalation.exception';
import { EscalationResponseDto } from '../dto/escalation.dto';

/**
 * 🎯 Use Case — Agent bấm "Acknowledge" (TDD Mục 9: ESCALATED ->
 * IN_PROGRESS). Gán `assignedAgentId` lên CẢ Escalation lẫn Ticket để
 * Dashboard (Phase 8) không phải join thêm bảng.
 */
@Injectable()
export class AcknowledgeEscalationUseCase {
  constructor(
    @Inject(ESCALATION_REPOSITORY) private readonly escalationRepository: IEscalationRepository,
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(escalationId: string, agentId: string): Promise<EscalationResponseDto> {
    const escalation = await this.escalationRepository.findById(escalationId);
    if (!escalation) {
      throw new EscalationNotFoundException(escalationId);
    }

    escalation.acknowledge(agentId);
    await this.escalationRepository.save(escalation);

    const ticket = await this.ticketRepository.findById(escalation.ticketId);
    if (ticket) {
      ticket.assignAgent(agentId);
      if (ticket.status === TicketStatus.ESCALATED) {
        ticket.transitionTo(TicketStatus.IN_PROGRESS, `agent:${agentId}`);
      }
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
