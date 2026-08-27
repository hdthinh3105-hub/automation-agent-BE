import { Entity } from '@app/shared/base/entity.base';

export interface RoutingRuleProps {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  conditions: Record<string, unknown>;
  action: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoutingRule extends Entity<string> {
  private props: RoutingRuleProps;

  private constructor(props: RoutingRuleProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    name: string;
    description?: string;
    isActive?: boolean;
    priority?: number;
    conditions: Record<string, unknown>;
    action: string;
    createdBy?: string;
  }): RoutingRule {
    const now = new Date();
    return new RoutingRule({
      id: params.id,
      name: params.name,
      description: params.description ?? null,
      isActive: params.isActive ?? true,
      priority: params.priority ?? 0,
      conditions: params.conditions,
      action: params.action,
      createdBy: params.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: RoutingRuleProps): RoutingRule {
    return new RoutingRule(props);
  }

  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  public updateConditions(conditions: Record<string, unknown>): void {
    this.props.conditions = conditions;
    this.props.updatedAt = new Date();
  }

  public get name(): string {
    return this.props.name;
  }

  public get description(): string | null {
    return this.props.description;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get priority(): number {
    return this.props.priority;
  }

  public get conditions(): Record<string, unknown> {
    return this.props.conditions;
  }

  public get action(): string {
    return this.props.action;
  }

  public get createdBy(): string | null {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
