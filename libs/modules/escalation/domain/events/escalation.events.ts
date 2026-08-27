import { IDomainEvent } from '@app/shared/base/aggregate-root.base';

export class EscalationCreatedEvent implements IDomainEvent {
  public readonly eventName = 'escalation.created';
  public readonly occurredAt: Date;

  constructor(
    public readonly escalationId: string,
    public readonly ticketId: string,
    public readonly reason: string,
  ) {
    this.occurredAt = new Date();
  }
}

export class EscalationAcknowledgedEvent implements IDomainEvent {
  public readonly eventName = 'escalation.acknowledged';
  public readonly occurredAt: Date;

  constructor(
    public readonly escalationId: string,
    public readonly ticketId: string,
    public readonly agentId: string,
  ) {
    this.occurredAt = new Date();
  }
}

export class EscalationResolvedEvent implements IDomainEvent {
  public readonly eventName = 'escalation.resolved';
  public readonly occurredAt: Date;

  constructor(
    public readonly escalationId: string,
    public readonly ticketId: string,
  ) {
    this.occurredAt = new Date();
  }
}
