import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import {
  IAgentReadRepository,
  AgentListFilter,
  AgentReadRecord,
} from '../../application/ports/agent-read-repository.port';

@Injectable()
export class PrismaAgentReadRepository implements IAgentReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: AgentListFilter): Promise<AgentReadRecord[]> {
    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;

    const records = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async count(filter: AgentListFilter): Promise<number> {
    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;

    return this.prisma.user.count({ where });
  }
}
