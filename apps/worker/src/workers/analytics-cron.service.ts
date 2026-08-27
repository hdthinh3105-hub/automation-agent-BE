import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ComputeDailySnapshotUseCase } from '@app/modules/analytics';

/**
 * TDD Mục 12 — Analytics Worker (cron 00:05 mỗi ngày, tính snapshot cho
 * NGÀY HÔM TRƯỚC). Idempotent (upsert theo `date`).
 */
@Injectable()
export class AnalyticsCronService {
  private readonly logger = new Logger(AnalyticsCronService.name);

  constructor(private readonly computeDailySnapshotUseCase: ComputeDailySnapshotUseCase) {}

  @Cron('5 0 * * *')
  async runDailySnapshot(): Promise<void> {
    this.logger.log('Bắt đầu tính Daily Metric Snapshot...');
    try {
      await this.computeDailySnapshotUseCase.execute();
    } catch (error) {
      this.logger.error(`Tính Daily Metric Snapshot thất bại: ${(error as Error).message}`);
    }
  }
}
