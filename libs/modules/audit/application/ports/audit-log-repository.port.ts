import { AuditLog } from '../../domain/entities/audit-log.entity';

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface ListAuditLogsFilter {
  resourceType?: string;
  actorId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface IAuditLogRepository {
  save(log: AuditLog): Promise<void>;
  list(filter: ListAuditLogsFilter): Promise<{ items: AuditLog[]; totalItems: number }>;
}
