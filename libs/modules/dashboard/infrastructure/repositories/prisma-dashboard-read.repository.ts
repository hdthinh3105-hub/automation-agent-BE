import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import {
  IDashboardReadRepository,
  OverviewStats,
  TrendPoint,
  AiPerformanceStats,
} from '../../application/ports/dashboard-read-repository.port';

/**
 * TDD Mục 5.12 — Dashboard Module read side. `getOverview`/
 * `getAiPerformance` đọc trực tiếp bảng `tickets` (real-time, quy mô
 * Assessment đủ nhỏ để không tạo áp lực OLTP đáng kể); `getTrends` đọc
 * từ `daily_metric_snapshots` đã materialize sẵn bởi Analytics Worker
 * (TDD Mục 5.12: "tránh tạo áp lực lên OLTP tables" cho truy vấn lịch
 * sử nhiều ngày).
 */
@Injectable()
export class PrismaDashboardReadRepository implements IDashboardReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<OverviewStats> {
    const [byStatusRaw, byPriorityRaw, totalTickets] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
      this.prisma.ticket.count(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) byStatus[row.status] = row._count._all;

    const byPriority: Record<string, number> = {};
    for (const row of byPriorityRaw) byPriority[row.priority ?? 'CHUA_PHAN_LOAI'] = row._count._all;

    const autoResolved = (byStatus['ANSWERED'] ?? 0) + (byStatus['RESOLVED'] ?? 0);
    const escalated = (byStatus['ESCALATED'] ?? 0) + (byStatus['IN_PROGRESS'] ?? 0);
    const denominator = totalTickets || 1;

    return {
      totalTickets,
      byStatus,
      byPriority,
      autoResolveRate: autoResolved / denominator,
      escalationRate: escalated / denominator,
    };
  }

  async getTrends(from: Date, to: Date): Promise<TrendPoint[]> {
    const records = await this.prisma.dailyMetricSnapshot.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return records.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      totalTickets: r.totalTickets,
      autoResolvedCount: r.autoResolvedCount,
      escalatedCount: r.escalatedCount,
      avgConfidence: r.avgConfidence,
    }));
  }

  async getAiPerformance(): Promise<AiPerformanceStats> {
    const [tickets, confidenceAgg] = await Promise.all([
      this.prisma.ticket.findMany({ select: { status: true } }),
      this.prisma.ticket.aggregate({ _avg: { confidenceScore: true } }),
    ]);
    const total = tickets.length || 1;
    const autoResolved = tickets.filter(
      (t) => t.status === 'ANSWERED' || t.status === 'RESOLVED',
    ).length;
    const escalated = tickets.filter(
      (t) => t.status === 'ESCALATED' || t.status === 'IN_PROGRESS',
    ).length;

    return {
      avgConfidence: confidenceAgg._avg.confidenceScore,
      autoResolveRate: autoResolved / total,
      escalationRate: escalated / total,
    };
  }
}
