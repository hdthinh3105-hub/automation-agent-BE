import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { Escalation } from '../../domain/entities/escalation.entity';
import {
  IEscalationRepository,
  ListEscalationsFilter,
} from '../../application/ports/escalation-repository.port';
import { EscalationMapper } from './escalation.mapper';

@Injectable()
export class PrismaEscalationRepository implements IEscalationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(escalation: Escalation): Promise<void> {
    const data = EscalationMapper.toPersistence(escalation);
    await this.prisma.escalation.upsert({
      where: { id: data.id },
      create: data,
      update: {
        status: data.status,
        assignedAgentId: data.assignedAgentId,
        resolutionNote: data.resolutionNote,
        acknowledgedAt: data.acknowledgedAt,
        resolvedAt: data.resolvedAt,
      },
    });
  }

  async findById(id: string): Promise<Escalation | null> {
    const record = await this.prisma.escalation.findUnique({ where: { id } });
    return record ? EscalationMapper.toDomain(record) : null;
  }

  async list(filter: ListEscalationsFilter): Promise<{ items: Escalation[]; totalItems: number }> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.assignedAgentId) where.assignedAgentId = filter.assignedAgentId;

    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.escalation.findMany({
        where,
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.escalation.count({ where }),
    ]);

    return { items: records.map((r) => EscalationMapper.toDomain(r)), totalItems };
  }
}
