import { Module } from '@nestjs/common';
import { RoutingPolicyService } from './application/services/routing-policy.service';
import { DetermineRoutingUseCase } from './application/use-cases/determine-routing.use-case';

/**
 * TDD Mục 5.8 — Routing Module. Không phụ thuộc module nào khác (thuần
 * policy stateless, config-driven qua ConfigService) — an toàn khi được
 * AI Module import mà không tạo circular dependency.
 */
@Module({
  providers: [RoutingPolicyService, DetermineRoutingUseCase],
  exports: [DetermineRoutingUseCase],
})
export class RoutingModule {}
