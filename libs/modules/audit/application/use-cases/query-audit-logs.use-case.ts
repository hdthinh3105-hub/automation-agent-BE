import { Inject, Injectable } from '@nestjs/common';
import { paginate, PaginatedResult } from '@app/shared/dto/pagination.dto';
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
  ListAuditLogsFilter,
} from '../ports/audit-log-repository.port';
import { AuditLogResponseDto } from '../dto/audit-log.dto';

@Injectable()
export class QueryAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async execute(filter: ListAuditLogsFilter): Promise<PaginatedResult<AuditLogResponseDto>> {
    const { items, totalItems } = await this.auditLogRepository.list(filter);
    const dtos: AuditLogResponseDto[] = items.map((log) => ({
      id: log.id,
      actorType: log.actorType,
      actorId: log.actorId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      changesJson: log.changesJson,
      createdAt: log.createdAt,
    }));
    return paginate(dtos, totalItems, filter.page, filter.limit);
  }
}
