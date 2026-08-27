import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import {
  ITicketMetricsProvider,
  DailyTicketMetrics,
} from '../../application/ports/ticket-metrics-provider.port';

/**
 * TDD Mục 5.14 — tính chỉ số ticket theo ngày qua aggregation trực tiếp
 * trên bảng `tickets`. Dùng PrismaService trực tiếp (không qua
 * `ITicketReadRepository` của Ticket Module) vì đây là truy vấn chuyên
 * biệt cho Analytics, giữ đúng ranh giới "Dashboard/Analytics tách biệt
 * để không phình Ticket Module" (TDD Mục 5.12).
 */
@Injectable()
export class PrismaTicketMetricsProvider implements ITicketMetricsProvider {
  constructor(private readonly prisma: PrismaService) {}

  async computeForDay(dayStart: Date, dayEnd: Date): Promise<DailyTicketMetrics> {
    const tickets = await this.prisma.ticket.findMany({
      where: { createdAt: { gte: dayStart, lt: dayEnd } },
      select: {
        status: true,
        category: true,
        confidenceScore: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const totalTickets = tickets.length;
    const autoResolvedCount = tickets.filter(
      (t) => t.status === 'ANSWERED' || t.status === 'RESOLVED',
    ).length;
    const escalatedCount = tickets.filter(
      (t) => t.status === 'ESCALATED' || t.status === 'IN_PROGRESS',
    ).length;

    const confidences = tickets
      .map((t) => t.confidenceScore)
      .filter((c): c is number => c !== null);
    const avgConfidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

    const responseTimes = tickets
      .filter((t) => t.resolvedAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime());
    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;

    const byCategory: Record<string, number> = {};
    for (const t of tickets) {
      const key = t.category ?? 'Chưa phân loại';
      byCategory[key] = (byCategory[key] ?? 0) + 1;
    }

    return {
      totalTickets,
      autoResolvedCount,
      escalatedCount,
      avgConfidence,
      avgResponseTimeMs,
      byCategory,
    };
  }
}
