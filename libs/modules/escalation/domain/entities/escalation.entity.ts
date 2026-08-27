import { AggregateRoot } from '@app/shared/base/aggregate-root.base';
import {
  EscalationCreatedEvent,
  EscalationAcknowledgedEvent,
  EscalationResolvedEvent,
} from '../events/escalation.events';
import { InvalidEscalationTransitionException } from '../exceptions/escalation.exception';

export enum EscalationReason {
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  EXPLICIT_REQUEST = 'EXPLICIT_REQUEST',
  POLICY_RULE = 'POLICY_RULE',
  COMPLEX_CASE = 'COMPLEX_CASE',
}

export enum EscalationStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export interface EscalationProps {
  id: string;
  ticketId: string;
  reason: EscalationReason;
  assignedAgentId: string | null;
  slaDeadline: Date;
  status: EscalationStatus;
  resolutionNote: string | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

const DEFAULT_SLA_HOURS = 24;

/**
 * 🔑 Aggregate Root — Escalation Module (TDD Mục 5.9). Xử lý riêng biệt
 * luồng "chuyển cho người" vì đây là điểm giao thoa quan trọng giữa
 * Automation và Human-in-the-loop, cần audit chặt và SLA riêng.
 */
export class Escalation extends AggregateRoot<string> {
  private props: EscalationProps;

  private constructor(props: EscalationProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    ticketId: string;
    reason: EscalationReason;
    slaHours?: number;
  }): Escalation {
    const now = new Date();
    const slaHours = params.slaHours ?? DEFAULT_SLA_HOURS;
    const escalation = new Escalation({
      id: params.id,
      ticketId: params.ticketId,
      reason: params.reason,
      assignedAgentId: null,
      slaDeadline: new Date(now.getTime() + slaHours * 60 * 60 * 1000),
      status: EscalationStatus.PENDING,
      resolutionNote: null,
      createdAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
    });
    escalation.addDomainEvent(
      new EscalationCreatedEvent(escalation.id, params.ticketId, params.reason),
    );
    return escalation;
  }

  public static reconstitute(props: EscalationProps): Escalation {
    return new Escalation(props);
  }

  public get ticketId(): string {
    return this.props.ticketId;
  }

  public get reason(): EscalationReason {
    return this.props.reason;
  }

  public get assignedAgentId(): string | null {
    return this.props.assignedAgentId;
  }

  public get slaDeadline(): Date {
    return this.props.slaDeadline;
  }

  public get status(): EscalationStatus {
    return this.props.status;
  }

  public get resolutionNote(): string | null {
    return this.props.resolutionNote;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get acknowledgedAt(): Date | null {
    return this.props.acknowledgedAt;
  }

  public get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  public acknowledge(agentId: string): void {
    if (this.props.status !== EscalationStatus.PENDING) {
      throw new InvalidEscalationTransitionException(
        this.props.status,
        EscalationStatus.ACKNOWLEDGED,
      );
    }
    this.props.status = EscalationStatus.ACKNOWLEDGED;
    this.props.assignedAgentId = agentId;
    this.props.acknowledgedAt = new Date();
    this.addDomainEvent(new EscalationAcknowledgedEvent(this.id, this.props.ticketId, agentId));
  }

  public resolve(resolutionNote?: string): void {
    if (this.props.status !== EscalationStatus.ACKNOWLEDGED) {
      throw new InvalidEscalationTransitionException(this.props.status, EscalationStatus.RESOLVED);
    }
    this.props.status = EscalationStatus.RESOLVED;
    this.props.resolutionNote = resolutionNote ?? null;
    this.props.resolvedAt = new Date();
    this.addDomainEvent(new EscalationResolvedEvent(this.id, this.props.ticketId));
  }
}
