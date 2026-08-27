import { Entity } from '@app/shared/base/entity.base';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface NotificationLogProps {
  id: string;
  type: string;
  recipient: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  errorReason: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

/**
 * 🔑 Aggregate Root — Notification Module (TDD Mục 5.10).
 */
export class NotificationLog extends Entity<string> {
  private props: NotificationLogProps;

  private constructor(props: NotificationLogProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    type: string;
    recipient: string;
    channel: NotificationChannel;
    payload?: Record<string, unknown>;
  }): NotificationLog {
    return new NotificationLog({
      id: params.id,
      type: params.type,
      recipient: params.recipient,
      channel: params.channel,
      status: NotificationStatus.QUEUED,
      payload: params.payload ?? null,
      errorReason: null,
      createdAt: new Date(),
      sentAt: null,
    });
  }

  public static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }

  public get type(): string {
    return this.props.type;
  }
  public get recipient(): string {
    return this.props.recipient;
  }
  public get channel(): NotificationChannel {
    return this.props.channel;
  }
  public get status(): NotificationStatus {
    return this.props.status;
  }
  public get payload(): Record<string, unknown> | null {
    return this.props.payload;
  }
  public get errorReason(): string | null {
    return this.props.errorReason;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get sentAt(): Date | null {
    return this.props.sentAt;
  }

  public markSent(): void {
    this.props.status = NotificationStatus.SENT;
    this.props.sentAt = new Date();
  }

  public markFailed(reason: string): void {
    this.props.status = NotificationStatus.FAILED;
    this.props.errorReason = reason;
  }
}
