import { Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_READ_REPOSITORY,
  IDashboardReadRepository,
} from '../ports/dashboard-read-repository.port';
import { OverviewStatsDto } from '../dto/dashboard.dto';

@Injectable()
export class GetOverviewStatsUseCase {
  constructor(
    @Inject(DASHBOARD_READ_REPOSITORY)
    private readonly dashboardReadRepository: IDashboardReadRepository,
  ) {}

  async execute(): Promise<OverviewStatsDto> {
    return this.dashboardReadRepository.getOverview();
  }
}
