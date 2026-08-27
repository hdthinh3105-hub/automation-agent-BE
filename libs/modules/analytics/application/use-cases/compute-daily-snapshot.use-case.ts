import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TICKET_METRICS_PROVIDER,
  ITicketMetricsProvider,
} from '../ports/ticket-metrics-provider.port';
import {
  METRIC_SNAPSHOT_REPOSITORY,
  IMetricSnapshotRepository,
} from '../ports/metric-snapshot-repository.port';
import { DailyMetricSnapshot } from '../../domain/entities/daily-metric-snapshot.entity';

/**
 * 🎯 `ComputeDailySnapshotUseCase` (TDD Mục 5.14) — chạy bởi Analytics
 * Worker theo cron (00:05 mỗi ngày, tính cho NGÀY HÔM TRƯỚC). Idempotent
 * — tính lại an toàn (upsert theo `date`, TDD Mục 12).
 */
@Injectable()
export class ComputeDailySnapshotUseCase {
  private readonly logger = new Logger(ComputeDailySnapshotUseCase.name);

  constructor(
    @Inject(TICKET_METRICS_PROVIDER) private readonly ticketMetricsProvider: ITicketMetricsProvider,
    @Inject(METRIC_SNAPSHOT_REPOSITORY)
    private readonly metricSnapshotRepository: IMetricSnapshotRepository,
  ) {}

  /** @param targetDate mặc định là "hôm qua" nếu không truyền. */
  async execute(targetDate?: Date): Promise<void> {
    const dayStart = this.startOfDay(targetDate ?? this.yesterday());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const metrics = await this.ticketMetricsProvider.computeForDay(dayStart, dayEnd);

    const snapshot = DailyMetricSnapshot.create({
      date: dayStart,
      totalTickets: metrics.totalTickets,
      autoResolvedCount: metrics.autoResolvedCount,
      escalatedCount: metrics.escalatedCount,
      avgConfidence: metrics.avgConfidence,
      avgResponseTimeMs: metrics.avgResponseTimeMs,
      byCategory: metrics.byCategory,
    });
    await this.metricSnapshotRepository.upsert(snapshot);
    this.logger.log(
      `Snapshot cho ngày ${dayStart.toISOString().slice(0, 10)}: ${metrics.totalTickets} ticket(s).`,
    );
  }

  private startOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private yesterday(): Date {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
}
