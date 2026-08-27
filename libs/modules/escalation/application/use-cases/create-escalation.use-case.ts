import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import {
  ITicketRepository,
  TICKET_REPOSITORY,
  TicketStatus,
  TicketNotFoundException,
} from '@app/modules/ticket';
import { ESCALATION_REPOSITORY, IEscalationRepository } from '../ports/escalation-repository.port';
import { Escalation, EscalationReason } from '../../domain/entities/escalation.entity';
import { EscalationResponseDto } from '../dto/escalation.dto';

export interface CreateEscalationCommand {
  ticketId: string;
  reason: string;
  /**
   * Mặc định `true` — use case tự transition ticket sang ESCALATED.
   * AI Module (`ProcessIncomingMessageUseCase`) truyền `false` vì đã tự
   * transition TRƯỚC khi gọi, tránh gọi transitionTo() 2 lần cho cùng 1
   * request.
   */
  transitionTicket?: boolean;
  /** userId của Agent bấm nút "Escalate" thủ công qua API (nếu có). */
  actorId?: string;
}

/**
 * 🎯 Use Case — tạo Escalation record (TDD Mục 5.9). Được gọi từ 2 nơi:
 * (a) AI Module sau khi TỰ transition ticket sang ESCALATED
 * (`transitionTicket=false`); (b) `EscalationController` khi Agent chủ
 * động escalate thủ công qua API (`transitionTicket=true`, mặc định).
 */
@Injectable()
export class CreateEscalationUseCase {
  constructor(
    @Inject(ESCALATION_REPOSITORY) private readonly escalationRepository: IEscalationRepository,
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateEscalationCommand): Promise<EscalationResponseDto> {
    const ticket = await this.ticketRepository.findById(command.ticketId);
    if (!ticket) {
      throw new TicketNotFoundException(command.ticketId);
    }

    if ((command.transitionTicket ?? true) && ticket.status !== TicketStatus.ESCALATED) {
      ticket.transitionTo(
        TicketStatus.ESCALATED,
        command.actorId ? `agent:${command.actorId}` : 'system:manual_escalation',
        command.reason,
      );
      await this.ticketRepository.save(ticket);
      for (const event of ticket.domainEvents) {
        this.eventEmitter.emit(event.eventName, event);
      }
      ticket.clearDomainEvents();
    }

    const escalation = Escalation.create({
      id: uuid(),
      ticketId: command.ticketId,
      reason: command.reason as EscalationReason,
    });
    await this.escalationRepository.save(escalation);

    for (const event of escalation.domainEvents) {
      this.eventEmitter.emit(event.eventName, event);
    }
    escalation.clearDomainEvents();

    return this.toDto(escalation);
  }

  private toDto(escalation: Escalation): EscalationResponseDto {
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
