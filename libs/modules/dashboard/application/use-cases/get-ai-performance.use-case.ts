import { Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_READ_REPOSITORY,
  IDashboardReadRepository,
} from '../ports/dashboard-read-repository.port';
import { AiPerformanceDto } from '../dto/dashboard.dto';

@Injectable()
export class GetAiPerformanceUseCase {
  constructor(
    @Inject(DASHBOARD_READ_REPOSITORY)
    private readonly dashboardReadRepository: IDashboardReadRepository,
  ) {}

  async execute(): Promise<AiPerformanceDto> {
    return this.dashboardReadRepository.getAiPerformance();
  }
}
