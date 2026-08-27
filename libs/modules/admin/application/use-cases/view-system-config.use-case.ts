import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, ICategoryRepository } from '../ports/category-repository.port';
import {
  ROUTING_RULE_REPOSITORY,
  IRoutingRuleRepository,
} from '../ports/routing-rule-repository.port';
import { CategoryResponseDto } from '../dto/category.dto';
import { RoutingRuleResponseDto } from '../dto/routing-rule.dto';

export interface SystemConfigResponse {
  categories: CategoryResponseDto[];
  routingRules: RoutingRuleResponseDto[];
}

@Injectable()
export class ViewSystemConfigUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    @Inject(ROUTING_RULE_REPOSITORY)
    private readonly routingRuleRepository: IRoutingRuleRepository,
  ) {}

  async execute(): Promise<SystemConfigResponse> {
    const [categories, routingRules] = await Promise.all([
      this.categoryRepository.list(),
      this.routingRuleRepository.list(),
    ]);

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
      routingRules: routingRules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isActive: r.isActive,
        priority: r.priority,
        conditions: r.conditions,
        action: r.action,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }
}
