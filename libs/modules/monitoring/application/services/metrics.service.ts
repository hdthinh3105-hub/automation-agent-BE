import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * TDD Mục 5.13/13.2 — `MetricsService`: đăng ký custom metric Prometheus
 * expose qua `/metrics`. Chỉ đăng ký business metric có sẵn dữ liệu ở
 * Đợt này; cập nhật giá trị do `MetricsListenerService` thực hiện khi
 * bắt Domain Event tương ứng.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  public readonly registry = new client.Registry();

  public readonly ticketsCreatedTotal = new client.Counter({
    name: 'tickets_created_total',
    help: 'Tổng số ticket được tạo, theo category',
    labelNames: ['category'],
  });

  public readonly ticketsEscalatedTotal = new client.Counter({
    name: 'tickets_escalated_total',
    help: 'Tổng số ticket bị escalate',
  });

  public readonly ticketsAutoResolvedTotal = new client.Counter({
    name: 'tickets_auto_resolved_total',
    help: 'Tổng số ticket AI tự trả lời thành công',
  });

  public readonly aiConfidenceScore = new client.Histogram({
    name: 'ai_confidence_score',
    help: 'Phân phối confidence score của câu trả lời AI',
    buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  });

  onModuleInit(): void {
    client.collectDefaultMetrics({ register: this.registry });
    [
      this.ticketsCreatedTotal,
      this.ticketsEscalatedTotal,
      this.ticketsAutoResolvedTotal,
      this.aiConfidenceScore,
    ].forEach((metric) => this.registry.registerMetric(metric));
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
