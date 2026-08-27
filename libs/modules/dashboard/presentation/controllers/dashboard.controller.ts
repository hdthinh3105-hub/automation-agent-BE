import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { GetOverviewStatsUseCase } from '../../application/use-cases/get-overview-stats.use-case';
import { GetTicketTrendUseCase } from '../../application/use-cases/get-ticket-trend.use-case';
import { GetAiPerformanceUseCase } from '../../application/use-cases/get-ai-performance.use-case';
import {
  OverviewStatsDto,
  TrendDto,
  AiPerformanceDto,
  TrendQueryDto,
} from '../../application/dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly getOverviewStatsUseCase: GetOverviewStatsUseCase,
    private readonly getTicketTrendUseCase: GetTicketTrendUseCase,
    private readonly getAiPerformanceUseCase: GetAiPerformanceUseCase,
  ) {}

  @Get('overview')
  @Roles(Role.AGENT, Role.ADMIN)
  async overview(): Promise<OverviewStatsDto> {
    return this.getOverviewStatsUseCase.execute();
  }

  @Get('trends')
  @Roles(Role.AGENT, Role.ADMIN)
  async trends(@Query() query: TrendQueryDto): Promise<TrendDto[]> {
    return this.getTicketTrendUseCase.execute(query.from, query.to);
  }

  @Get('ai-performance')
  @Roles(Role.ADMIN)
  async aiPerformance(): Promise<AiPerformanceDto> {
    return this.getAiPerformanceUseCase.execute();
  }
}
