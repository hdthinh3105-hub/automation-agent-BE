import { Module } from '@nestjs/common';
import { METRIC_SNAPSHOT_REPOSITORY } from './application/ports/metric-snapshot-repository.port';
import { TICKET_METRICS_PROVIDER } from './application/ports/ticket-metrics-provider.port';
import { PrismaMetricSnapshotRepository } from './infrastructure/repositories/prisma-metric-snapshot.repository';
import { PrismaTicketMetricsProvider } from './infrastructure/providers/prisma-ticket-metrics.provider';
import { ComputeDailySnapshotUseCase } from './application/use-cases/compute-daily-snapshot.use-case';

/**
 * TDD Mục 5.14 — Analytics Module. Không có Controller — chỉ được gọi
 * bởi Analytics Worker (cron, `apps/worker`). Dashboard Module đọc
 * `daily_metric_snapshots` trực tiếp qua Prisma (không phụ thuộc module
 * này) để giữ ranh giới đơn giản.
 */
@Module({
  providers: [
    { provide: METRIC_SNAPSHOT_REPOSITORY, useClass: PrismaMetricSnapshotRepository },
    { provide: TICKET_METRICS_PROVIDER, useClass: PrismaTicketMetricsProvider },
    ComputeDailySnapshotUseCase,
  ],
  exports: [METRIC_SNAPSHOT_REPOSITORY, ComputeDailySnapshotUseCase],
})
export class AnalyticsModule {}
