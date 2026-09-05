import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { JOBS_QUEUE } from '@app/infrastructure';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  checks: Record<string, boolean>;
}

/**
 * TDD Mục 5.13 — `HealthCheckService`: kiểm tra DB, Redis (qua BullMQ
 * Queue client — dùng chung 1 kết nối Redis đã có, không mở kết nối
 * riêng).
 */
@Injectable()
export class HealthCheckService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async checkReadiness(): Promise<HealthCheckResult> {
    const checks: Record<string, boolean> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.queue.client;
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const status = Object.values(checks).every(Boolean) ? 'ok' : 'degraded';
    return { status, checks };
  }
}
