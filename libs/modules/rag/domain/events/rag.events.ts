import { IDomainEvent } from '@app/shared/base/aggregate-root.base';

/**
 * Raised khi toàn bộ chunk của 1 document đã có embedding và document
 * chuyển `status=READY` (TDD Mục 5.6/7.2 bước [5]). Dashboard/Analytics
 * Module (Phase 8) có thể lắng nghe để cập nhật số liệu KB sẵn sàng.
 */
export class ChunksEmbeddedEvent implements IDomainEvent {
  public readonly eventName = 'rag.chunks_embedded';
  public readonly occurredAt: Date;

  constructor(
    public readonly documentId: string,
    public readonly chunkCount: number,
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Raised mỗi khi `GenerateAnswerUseCase` sinh xong 1 câu trả lời (TDD
 * Mục 5.6/7.2 bước [12]). AI Module (Phase 6) / Analytics Worker (Phase
 * 8) sẽ lắng nghe để ghi `PromptLog`/tính chỉ số `ai_confidence_score`.
 */
export class AnswerGeneratedEvent implements IDomainEvent {
  public readonly eventName = 'rag.answer_generated';
  public readonly occurredAt: Date;

  constructor(
    public readonly query: string,
    public readonly confidence: number,
    public readonly chunkIds: string[],
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Raised khi confidence < ngưỡng cấu hình (`rag.confidenceEscalationThreshold`)
 * hoặc không tìm được chunk liên quan nào (TDD Mục 7.2 bước [13] — Fallback
 * Strategy & Human Escalation). Escalation Module (Phase 7) sẽ lắng nghe
 * để tạo `Escalation` record với `reason=LOW_CONFIDENCE`.
 */
export class LowConfidenceAnswerEvent implements IDomainEvent {
  public readonly eventName = 'rag.low_confidence_answer';
  public readonly occurredAt: Date;

  constructor(
    public readonly query: string,
    public readonly confidence: number,
    public readonly reason: 'NO_RELEVANT_CONTENT' | 'BELOW_THRESHOLD',
  ) {
    this.occurredAt = new Date();
  }
}
