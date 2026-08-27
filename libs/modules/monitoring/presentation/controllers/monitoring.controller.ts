import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '@app/shared/decorators/public.decorator';
import { HealthCheckService } from '../../application/services/health-check.service';
import { MetricsService } from '../../application/services/metrics.service';

/**
 * TDD Mục 5.13 — `/health/ready`, `/health/live`, `/metrics`. Khác biệt
 * với `/health` (AppController, TDD Mục 1) là kiểm tra liveness/readiness
 * kỹ thuật chi tiết, không phải nghiệp vụ. `/metrics` đánh dấu `@Public()`
 * để Prometheus scrape không cần JWT — TDD Mục 11.8 khuyến nghị chặn
 * qua network policy khi triển khai thật (Render free tier chưa hỗ trợ
 * việc này ở Đợt bài — giới hạn đã biết, TDD Mục 17).
 */
@Controller()
export class MonitoringController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get('health/ready')
  async ready() {
    return this.healthCheckService.checkReadiness();
  }

  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async metrics(): Promise<string> {
    return this.metricsService.getMetricsText();
  }
}
