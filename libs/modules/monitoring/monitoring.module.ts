import { Module } from '@nestjs/common';
import { HealthCheckService } from './application/services/health-check.service';
import { MetricsService } from './application/services/metrics.service';
import { MetricsListenerService } from './application/services/metrics-listener.service';
import { MonitoringController } from './presentation/controllers/monitoring.controller';

@Module({
  controllers: [MonitoringController],
  providers: [HealthCheckService, MetricsService, MetricsListenerService],
  exports: [MetricsService],
})
export class MonitoringModule {}
