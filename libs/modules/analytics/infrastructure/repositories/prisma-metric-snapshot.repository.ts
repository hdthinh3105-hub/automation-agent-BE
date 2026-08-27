import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { DailyMetricSnapshot } from '../../domain/entities/daily-metric-snapshot.entity';
import { IMetricSnapshotRepository } from '../../application/ports/metric-snapshot-repository.port';
import { MetricSnapshotMapper } from './metric-snapshot.mapper';

@Injectable()
export class PrismaMetricSnapshotRepository implements IMetricSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(snapshot: DailyMetricSnapshot): Promise<void> {
    const data = MetricSnapshotMapper.toPersistence(snapshot);
    await this.prisma.dailyMetricSnapshot.upsert({
      where: { date: data.date },
      create: data,
      update: {
        totalTickets: data.totalTickets,
        autoResolvedCount: data.autoResolvedCount,
        escalatedCount: data.escalatedCount,
        avgConfidence: data.avgConfidence,
        avgResponseTimeMs: data.avgResponseTimeMs,
        byCategory: data.byCategory,
      },
    });
  }

  async listRange(from: Date, to: Date): Promise<DailyMetricSnapshot[]> {
    const records = await this.prisma.dailyMetricSnapshot.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return records.map(MetricSnapshotMapper.toDomain);
  }
}
