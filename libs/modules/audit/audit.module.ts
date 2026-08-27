import { Module } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY } from './application/ports/audit-log-repository.port';
import { PrismaAuditLogRepository } from './infrastructure/repositories/prisma-audit-log.repository';
import { AuditListenerService } from './application/services/audit-listener.service';
import { QueryAuditLogsUseCase } from './application/use-cases/query-audit-logs.use-case';
import { AuditController } from './presentation/controllers/audit.controller';

/**
 * TDD Mục 5.11 — Audit Module. Import module này vào CẢ `apps/api` lẫn
 * `apps/worker` (mỗi process chỉ "thấy" Domain Event do CHÍNH NÓ phát
 * ra — 2 EventEmitter2 instance độc lập, TDD Mục 2.6/12) để không bỏ
 * sót event phát sinh trong Worker (vd DocumentProcessingFailedEvent).
 * `AuditController` (route `/admin/audit-logs`) chỉ thực sự hữu ích khi
 * chạy trong `apps/api` — ở Worker nó vẫn đăng ký nhưng không route HTTP
 * nào gọi tới (Worker không expose HTTP ngoài health-check tối giản).
 */
@Module({
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    AuditListenerService,
    QueryAuditLogsUseCase,
  ],
  exports: [AUDIT_LOG_REPOSITORY],
})
export class AuditModule {}
