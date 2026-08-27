import { Entity } from '@app/shared/base/entity.base';

export enum ActorType {
  USER = 'USER',
  AI = 'AI',
  SYSTEM = 'SYSTEM',
}

export interface AuditLogProps {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  changesJson: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * 📦 Entity — append-only (TDD Mục 5.11). Không có Update/Delete use case.
 */
export class AuditLog extends Entity<string> {
  private props: AuditLogProps;

  private constructor(props: AuditLogProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    actorType: ActorType;
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    changesJson?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }): AuditLog {
    return new AuditLog({
      id: params.id,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      changesJson: params.changesJson ?? null,
      ipAddress: params.ipAddress ?? null,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  public get actorType(): ActorType {
    return this.props.actorType;
  }
  public get actorId(): string | null {
    return this.props.actorId;
  }
  public get action(): string {
    return this.props.action;
  }
  public get resourceType(): string {
    return this.props.resourceType;
  }
  public get resourceId(): string {
    return this.props.resourceId;
  }
  public get changesJson(): Record<string, unknown> | null {
    return this.props.changesJson;
  }
  public get ipAddress(): string | null {
    return this.props.ipAddress;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
