import { Module } from '@nestjs/common';
import { DASHBOARD_READ_REPOSITORY } from './application/ports/dashboard-read-repository.port';
import { PrismaDashboardReadRepository } from './infrastructure/repositories/prisma-dashboard-read.repository';
import { GetOverviewStatsUseCase } from './application/use-cases/get-overview-stats.use-case';
import { GetTicketTrendUseCase } from './application/use-cases/get-ticket-trend.use-case';
import { GetAiPerformanceUseCase } from './application/use-cases/get-ai-performance.use-case';
import { DashboardController } from './presentation/controllers/dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [
    { provide: DASHBOARD_READ_REPOSITORY, useClass: PrismaDashboardReadRepository },
    GetOverviewStatsUseCase,
    GetTicketTrendUseCase,
    GetAiPerformanceUseCase,
  ],
})
export class DashboardModule {}
