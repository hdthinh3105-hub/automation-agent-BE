import { Inject, Injectable } from '@nestjs/common';
import { paginate, PaginatedResult } from '@app/shared/dto/pagination.dto';
import { AGENT_READ_REPOSITORY, IAgentReadRepository } from '../ports/agent-read-repository.port';
import { AgentResponseDto, ListAgentsQueryDto } from '../dto/agent.dto';

@Injectable()
export class ManageAgentsUseCase {
  constructor(
    @Inject(AGENT_READ_REPOSITORY)
    private readonly agentReadRepository: IAgentReadRepository,
  ) {}

  async list(query: ListAgentsQueryDto): Promise<PaginatedResult<AgentResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = { role: query.role, page, limit };

    const [items, totalItems] = await Promise.all([
      this.agentReadRepository.list(filter),
      this.agentReadRepository.count(filter),
    ]);

    const dtos: AgentResponseDto[] = items.map((agent) => ({
      id: agent.id,
      email: agent.email,
      role: agent.role,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
    }));

    return paginate(dtos, totalItems, page, limit);
  }
}
