import { Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_READ_REPOSITORY,
  IDashboardReadRepository,
} from '../ports/dashboard-read-repository.port';
import { TrendDto } from '../dto/dashboard.dto';

@Injectable()
export class GetTicketTrendUseCase {
  constructor(
    @Inject(DASHBOARD_READ_REPOSITORY)
    private readonly dashboardReadRepository: IDashboardReadRepository,
  ) {}

  async execute(from?: string, to?: string): Promise<TrendDto[]> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.dashboardReadRepository.getTrends(fromDate, toDate);
  }
}
