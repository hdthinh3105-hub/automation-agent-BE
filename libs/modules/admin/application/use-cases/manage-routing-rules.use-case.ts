import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  ROUTING_RULE_REPOSITORY,
  IRoutingRuleRepository,
} from '../ports/routing-rule-repository.port';
import { RoutingRule } from '../../domain/entities/routing-rule.entity';
import {
  CreateRoutingRuleDto,
  UpdateRoutingRuleDto,
  RoutingRuleResponseDto,
} from '../dto/routing-rule.dto';

export interface ListRoutingRulesResult {
  items: RoutingRuleResponseDto[];
}

@Injectable()
export class ManageRoutingRulesUseCase {
  constructor(
    @Inject(ROUTING_RULE_REPOSITORY)
    private readonly routingRuleRepository: IRoutingRuleRepository,
  ) {}

  private toResponseDto(rule: RoutingRule): RoutingRuleResponseDto {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      isActive: rule.isActive,
      priority: rule.priority,
      conditions: rule.conditions,
      action: rule.action,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  async list(): Promise<RoutingRuleResponseDto[]> {
    const rules = await this.routingRuleRepository.list();
    return rules.map((r) => this.toResponseDto(r));
  }

  async create(dto: CreateRoutingRuleDto): Promise<RoutingRuleResponseDto> {
    const rule = RoutingRule.create({
      id: uuid(),
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
      priority: dto.priority,
      conditions: dto.conditions,
      action: dto.action,
      createdBy: dto.createdBy,
    });
    await this.routingRuleRepository.create(rule);
    return this.toResponseDto(rule);
  }

  async update(id: string, dto: UpdateRoutingRuleDto): Promise<RoutingRuleResponseDto> {
    const existing = await this.routingRuleRepository.findById(id);
    if (!existing) {
      throw new Error(`Routing rule with id "${id}" not found`);
    }

    const updated = RoutingRule.reconstitute({
      id: existing.id,
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      priority: dto.priority !== undefined ? dto.priority : existing.priority,
      conditions: dto.conditions ?? existing.conditions,
      action: dto.action ?? existing.action,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.routingRuleRepository.update(updated);
    return this.toResponseDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.routingRuleRepository.findById(id);
    if (!existing) {
      throw new Error(`Routing rule with id "${id}" not found`);
    }
    await this.routingRuleRepository.delete(id);
  }
}
