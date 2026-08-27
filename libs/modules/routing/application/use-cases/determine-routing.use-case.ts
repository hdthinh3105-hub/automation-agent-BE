import { Injectable } from '@nestjs/common';
import { RoutingPolicyService, RoutingPolicyInput } from '../services/routing-policy.service';
import { RoutingDecision } from '../../domain/value-objects/routing-decision.vo';

/**
 * 🎯 Use Case mỏng bọc `RoutingPolicyService` (TDD Mục 5.8 —
 * `DetermineRoutingUseCase`), giữ đúng pattern "mỗi Use Case = 1 hành
 * động nghiệp vụ" dù logic thật nằm ở Service.
 */
@Injectable()
export class DetermineRoutingUseCase {
  constructor(private readonly routingPolicyService: RoutingPolicyService) {}

  execute(input: RoutingPolicyInput): RoutingDecision {
    return this.routingPolicyService.decide(input);
  }
}
