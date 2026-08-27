import { AggregateRoot } from '@app/shared/base/aggregate-root.base';
import { TicketStatus, isValidTicketTransition } from '../value-objects/ticket-status.vo';
import { PriorityLevel } from '../value-objects/priority-level.vo';
import { Channel } from '../value-objects/channel.vo';
import { InvalidTicketTransitionException } from '../exceptions/ticket.exception';
import { TicketCreatedEvent, TicketStatusChangedEvent } from '../events/ticket.events';

export interface TicketProps {
  id: string;
  customerId: string;
  channel: Channel;
  subject: string;
  status: TicketStatus;
  category: string | null;
  priority: PriorityLevel | null;
  confidenceScore: number | null;
  assignedAgentId: string | null;
  isSpam: boolean;
  isDuplicateOf: string | null;
  missingInfoFlags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/**
 * 🔑 Aggregate Root — Ticket Module (TDD Mục 5.3, module lớn nhất/trung
 * tâm điều phối). Mọi thay đổi trạng thái đi qua entity này; validate
 * transition thực sự nằm ở TicketStateMachineService (Domain Service)
 * để tách "quy tắc chuyển trạng thái" khỏi "nơi lưu state" — entity chỉ
 * biết áp dụng transition đã được xác nhận hợp lệ.
 *
 * Ngày 4 (AI Module): bổ sung setter cho category/priority/confidence/
 * missingInfoFlags/isDuplicateOf (do `ProcessIncomingMessageUseCase` gọi
 * sau từng bước pipeline — TDD Mục 8) + `markSpamAndClose()` (bypass
 * state machine chính theo đúng TDD Mục 9).
 */
export class Ticket extends AggregateRoot<string> {
  private props: TicketProps;

  private constructor(props: TicketProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    customerId: string;
    channel: Channel;
    subject: string;
  }): Ticket {
    if (!params.subject?.trim()) {
      throw new Error('Ticket subject must not be empty');
    }
    const now = new Date();
    const ticket = new Ticket({
      id: params.id,
      customerId: params.customerId,
      channel: params.channel,
      subject: params.subject.trim(),
      status: TicketStatus.NEW,
      category: null,
      priority: null,
      confidenceScore: null,
      assignedAgentId: null,
      isSpam: false,
      isDuplicateOf: null,
      missingInfoFlags: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    ticket.addDomainEvent(new TicketCreatedEvent(ticket.id, params.customerId, params.channel));
    return ticket;
  }

  public static reconstitute(props: TicketProps): Ticket {
    return new Ticket(props);
  }

  public get customerId(): string {
    return this.props.customerId;
  }

  public get channel(): Channel {
    return this.props.channel;
  }

  public get subject(): string {
    return this.props.subject;
  }

  public get status(): TicketStatus {
    return this.props.status;
  }

  public get category(): string | null {
    return this.props.category;
  }

  public get priority(): PriorityLevel | null {
    return this.props.priority;
  }

  public get confidenceScore(): number | null {
    return this.props.confidenceScore;
  }

  public get assignedAgentId(): string | null {
    return this.props.assignedAgentId;
  }

  public get isSpam(): boolean {
    return this.props.isSpam;
  }

  public get isDuplicateOf(): string | null {
    return this.props.isDuplicateOf;
  }

  public get missingInfoFlags(): string[] {
    return this.props.missingInfoFlags;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  /**
   * Đổi trạng thái ticket — validate qua ma trận VALID_TICKET_TRANSITIONS,
   * throw InvalidTicketTransitionException nếu sai (TDD Mục 9), ghi lại
   * TicketStatusChangedEvent để Use Case dispatch + tạo TicketStatusHistory.
   */
  public transitionTo(targetStatus: TicketStatus, changedBy: string, reason?: string): void {
    const currentStatus = this.props.status;
    if (currentStatus === targetStatus) return; // idempotent no-op

    if (!isValidTicketTransition(currentStatus, targetStatus)) {
      throw new InvalidTicketTransitionException(currentStatus, targetStatus);
    }

    this.props.status = targetStatus;
    this.props.updatedAt = new Date();
    if (targetStatus === TicketStatus.RESOLVED) {
      this.props.resolvedAt = new Date();
    }

    this.addDomainEvent(
      new TicketStatusChangedEvent(this.id, currentStatus, targetStatus, changedBy, reason),
    );
  }

  public assignAgent(agentId: string): void {
    this.props.assignedAgentId = agentId;
    this.props.updatedAt = new Date();
  }

  /**
   * AI Module gọi sau bước Classification + Priority Detection (TDD Mục
   * 8, bước 1 + 5) — gắn category/priority vào ticket, KHÔNG tự đổi
   * status (transition NEW->CLASSIFIED do orchestrator gọi riêng qua
   * `transitionTo()`).
   */
  public applyClassification(category: string, priority: PriorityLevel): void {
    this.props.category = category;
    this.props.priority = priority;
    this.props.updatedAt = new Date();
  }

  /** AI Module gọi sau bước Missing Information Detection (TDD Mục 8, bước 4). */
  public applyMissingInfoFlags(flags: string[]): void {
    this.props.missingInfoFlags = flags;
    this.props.updatedAt = new Date();
  }

  /** RAG/AI Module gọi sau bước Confidence Evaluation (TDD Mục 8, bước 8). */
  public applyConfidenceScore(score: number): void {
    this.props.confidenceScore = score;
    this.props.updatedAt = new Date();
  }

  /** AI Module gọi sau bước Duplicate Detection khi phát hiện trùng lặp (TDD Mục 8, bước 3). */
  public markDuplicateOf(originalTicketId: string): void {
    this.props.isDuplicateOf = originalTicketId;
    this.props.updatedAt = new Date();
  }

  /**
   * TDD Mục 9 — "bất kỳ -> (Ticket bị đánh dấu spam) — không đi qua
   * state machine chính, đóng thẳng với trạng thái riêng
   * status=CLOSED, closeReason=SPAM". Bypass `isValidTicketTransition`
   * có chủ đích: đây là override nghiệp vụ tường minh của AI Module,
   * không phải lỗi luồng.
   */
  public markSpamAndClose(changedBy: string): void {
    this.props.isSpam = true;
    const fromStatus = this.props.status;
    this.props.status = TicketStatus.CLOSED;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new TicketStatusChangedEvent(
        this.id,
        fromStatus,
        TicketStatus.CLOSED,
        changedBy,
        'SPAM_DETECTED',
      ),
    );
  }
}
