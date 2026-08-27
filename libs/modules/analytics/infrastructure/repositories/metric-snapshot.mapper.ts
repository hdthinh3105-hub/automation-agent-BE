import { DailyMetricSnapshot as PrismaDailyMetricSnapshot } from '@prisma/client';
import { DailyMetricSnapshot } from '../../domain/entities/daily-metric-snapshot.entity';

export class MetricSnapshotMapper {
  static toDomain(record: PrismaDailyMetricSnapshot): DailyMetricSnapshot {
    return DailyMetricSnapshot.reconstitute({
      date: record.date,
      totalTickets: record.totalTickets,
      autoResolvedCount: record.autoResolvedCount,
      escalatedCount: record.escalatedCount,
      avgConfidence: record.avgConfidence,
      avgResponseTimeMs: record.avgResponseTimeMs,
      byCategory: record.byCategory as Record<string, number> | null,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(snapshot: DailyMetricSnapshot) {
    return {
      date: snapshot.date,
      totalTickets: snapshot.totalTickets,
      autoResolvedCount: snapshot.autoResolvedCount,
      escalatedCount: snapshot.escalatedCount,
      avgConfidence: snapshot.avgConfidence,
      avgResponseTimeMs: snapshot.avgResponseTimeMs,
      byCategory: snapshot.byCategory ?? undefined,
    };
  }
}
