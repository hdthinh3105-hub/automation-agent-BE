import { Inject, Injectable } from '@nestjs/common';
import { paginate, PaginatedResult } from '@app/shared/dto/pagination.dto';
import {
  ESCALATION_REPOSITORY,
  IEscalationRepository,
  ListEscalationsFilter,
} from '../ports/escalation-repository.port';
import { EscalationResponseDto } from '../dto/escalation.dto';

@Injectable()
export class ListEscalationsUseCase {
  constructor(
    @Inject(ESCALATION_REPOSITORY) private readonly escalationRepository: IEscalationRepository,
  ) {}

  async execute(filter: ListEscalationsFilter): Promise<PaginatedResult<EscalationResponseDto>> {
    const { items, totalItems } = await this.escalationRepository.list(filter);
    const dtos: EscalationResponseDto[] = items.map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      reason: e.reason,
      assignedAgentId: e.assignedAgentId,
      slaDeadline: e.slaDeadline,
      status: e.status,
      resolutionNote: e.resolutionNote,
      createdAt: e.createdAt,
      acknowledgedAt: e.acknowledgedAt,
      resolvedAt: e.resolvedAt,
    }));
    return paginate(dtos, totalItems, filter.page, filter.limit);
  }
}
