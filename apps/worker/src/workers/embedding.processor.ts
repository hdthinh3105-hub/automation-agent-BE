import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { EMBEDDING_QUEUE, EmbeddingJobData } from '@app/infrastructure';
import { EmbedChunksUseCase } from '@app/modules/rag';
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  IKnowledgeDocumentRepository,
} from '@app/modules/knowledge-base';

/**
 * TDD Mục 12 — Embedding Worker.
 * Input: job `{documentId}` (enqueue bởi `DocumentParserProcessor` sau
 * khi chunk xong). Output: `ChunkEmbedding` records + `status=READY`.
 * Retry: 5 lần (API rate-limit dễ gặp hơn), backoff 5s/20s/60s/180s/300s
 * (khai báo ở `QueueModule.registerQueue`). Nếu bị gián đoạn giữa
 * chừng, job resume an toàn ở lần chạy lại vì `EmbedChunksUseCase` chỉ
 * xử lý chunk CHƯA có embedding (idempotent — TDD Mục 12 nguyên tắc
 * chung cho Worker: "chạy lại nhiều lần với cùng input không gây
 * side-effect sai").
 *
 * `drainDelay`/`stalledInterval` (root fix cho "quota tăng liên tục" trên
 * Upstash free 500k lệnh/tháng) là option của Worker (không phải Queue).
 * Queue rỗng, worker long-poll 1 lệnh Redis mỗi `drainDelay` giây: mặc định
 * 5s/worker ≈ 0.6 lệnh/s cho 3 worker ≈ 1.5M lệnh/tháng — vượt quota dù
 * không có job nào! Nới drain lên 120s (≈130k/tháng) + stalled 300s.
 * Job mới vẫn được đánh thức ngay qua pub/sub, không chờ hết drain.
 */
// `lockDuration` nâng lên 10 phút: embed nhiều chunk qua Gemini (mỗi chunk
// 1 HTTP request) dễ vượt lock mặc định 30s của BullMQ -> nếu không nâng sẽ
// dính lỗi "Missing lock for job" (worker mất quyền hoàn tất job giữa chừng).
@Processor(EMBEDDING_QUEUE, {
  drainDelay: 120,
  stalledInterval: 300_000,
  lockDuration: 600_000,
})
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embedChunksUseCase: EmbedChunksUseCase,
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY)
    private readonly documentRepository: IKnowledgeDocumentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<{ embeddedCount: number }> {
    const { documentId } = job.data;
    this.logger.log(
      `[job ${job.id}] Embedding chunks for document "${documentId}" (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const embeddedCount = await this.embedChunksUseCase.execute(documentId);
      this.logger.log(
        `[job ${job.id}] Document "${documentId}" embedded (${embeddedCount} chunk(s)), status=READY.`,
      );
      return { embeddedCount };
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        this.logger.error(
          `[job ${job.id}] Document "${documentId}" embedding failed permanently after ${job.attemptsMade + 1} attempt(s): ${(error as Error).message}`,
        );
        const document = await this.documentRepository.findById(documentId);
        if (document) {
          // Giữ nguyên tinh thần TDD Mục 12: status=PARTIALLY_EMBEDDED để
          // có thể resume — schema hiện tại (Đợt 1) chưa có state riêng
          // này (chỉ PENDING/PROCESSING/READY/FAILED), nên tạm dùng FAILED;
          // vì EmbedChunksUseCase vốn đã idempotent (chỉ embed chunk còn
          // thiếu), việc reprocess sau này vẫn resume đúng, không mất dữ
          // liệu embedding đã lưu thành công trước đó.
          document.markFailed((error as Error).message);
          await this.documentRepository.save(document);
          for (const event of document.domainEvents) {
            this.eventEmitter.emit(event.eventName, event);
          }
          document.clearDomainEvents();
        }
      }
      throw error;
    }
  }
}
