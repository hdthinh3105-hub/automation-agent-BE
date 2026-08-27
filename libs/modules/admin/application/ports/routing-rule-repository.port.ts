import { RoutingRule } from '../../domain/entities/routing-rule.entity';

export const ROUTING_RULE_REPOSITORY = Symbol('ROUTING_RULE_REPOSITORY');

export interface IRoutingRuleRepository {
  list(): Promise<RoutingRule[]>;
  findById(id: string): Promise<RoutingRule | null>;
  create(rule: RoutingRule): Promise<void>;
  update(rule: RoutingRule): Promise<void>;
  delete(id: string): Promise<void>;
}
