import { RoutingRule as PrismaRoutingRule, Prisma } from '@prisma/client';
import { RoutingRule } from '../../domain/entities/routing-rule.entity';

export class RoutingRuleMapper {
  static toDomain(record: PrismaRoutingRule): RoutingRule {
    return RoutingRule.reconstitute({
      id: record.id,
      name: record.name,
      description: record.description,
      isActive: record.isActive,
      priority: record.priority,
      conditions: record.conditions as Record<string, unknown>,
      action: record.action,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(rule: RoutingRule) {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      isActive: rule.isActive,
      priority: rule.priority,
      conditions: rule.conditions as unknown as Prisma.InputJsonValue,
      action: rule.action,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
