import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import {
  IAuditLogRepository,
  ListAuditLogsFilter,
} from '../../application/ports/audit-log-repository.port';
import { AuditLogMapper } from './audit-log.mapper';

@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(log: AuditLog): Promise<void> {
    const data = AuditLogMapper.toPersistence(log);
    await this.prisma.auditLog.create({ data });
  }

  async list(filter: ListAuditLogsFilter): Promise<{ items: AuditLog[]; totalItems: number }> {
    const where: Record<string, unknown> = {};
    if (filter.resourceType) where.resourceType = filter.resourceType;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lte: filter.dateTo } : {}),
      };
    }

    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: records.map(AuditLogMapper.toDomain), totalItems };
  }
}
