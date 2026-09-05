import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job, Queue } from 'bullmq';
import {
  DOCUMENT_PARSER_QUEUE,
  EMBEDDING_QUEUE,
  DocumentParserJobData,
  EmbeddingJobData,
} from '@app/infrastructure';
import { ChunkDocumentUseCase } from '@app/modules/rag';
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  IKnowledgeDocumentRepository,
} from '@app/modules/knowledge-base';

/**
 * TDD Mục 12 — Document Parser Worker.
 * Input: job `{documentId}` (enqueue bởi `DocumentUploadedListener` khi
 * `DocumentUploadedEvent` được phát ra từ Knowledge Base Module).
 * Output: `KnowledgeChunk` records; khi thành công -> enqueue job vào
 * Embedding Queue để tiếp tục bước [5] (TDD Mục 7.2).
 * Retry: 3 lần, backoff 2s/8s/32s (khai báo ở `QueueModule.registerQueue`).
 * Khi hết retry mà vẫn lỗi -> `KnowledgeDocument.status = FAILED` +
 * phát `DocumentProcessingFailedEvent` (Notification Module ở Phase 8 sẽ
 * lắng nghe để báo Admin — chưa có listener nào ở Đợt 1 này, sự kiện vẫn
 * được emit đúng chuẩn để không phải sửa lại chỗ này khi Phase 8 tới).
 *
 * `drainDelay`/`stalledInterval`/`guardInterval` (root fix cho "quota
 * tăng liên tục" trên Upstash free 500k lệnh/tháng) là option của Worker
 * (không phải Queue). Worker idle vẫn tick liên tục: guard mặc định 5s
 * (~0.2 lệnh/s/worker ≈ 518k/tháng cho 1 worker!) nên phải nới hết cỡ cho
 * vừa free-tier. Đánh đổi: job mới vẫn được đánh thức ngay qua pub/sub
 * (không chờ drain), chỉ retry có backoff (delayed) mới trễ thêm tối đa
 * ~guardInterval.
 */
// `lockDuration` nâng lên 5 phút: parse tài liệu (download remote + extract
// text + chunk) có thể lâu hơn lock mặc định 30s -> tránh "Missing lock for job".
@Processor(DOCUMENT_PARSER_QUEUE, {
  drainDelay: 120,
  stalledInterval: 300_000,
  guardInterval: 60_000,
  lockDuration: 300_000,
})
export class DocumentParserProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentParserProcessor.name);

  constructor(
    private readonly chunkDocumentUseCase: ChunkDocumentUseCase,
    @InjectQueue(EMBEDDING_QUEUE) private readonly embeddingQueue: Queue<EmbeddingJobData>,
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY)
    private readonly documentRepository: IKnowledgeDocumentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<DocumentParserJobData>): Promise<{ chunkCount: number }> {
    const { documentId } = job.data;
    this.logger.log(
      `[job ${job.id}] Parsing + chunking document "${documentId}" (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const chunkCount = await this.chunkDocumentUseCase.execute(documentId);
      await this.embeddingQueue.add('embed', { documentId });
      this.logger.log(
        `[job ${job.id}] Document "${documentId}" chunked (${chunkCount} chunk(s)), embedding job enqueued.`,
      );
      return { chunkCount };
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        this.logger.error(
          `[job ${job.id}] Document "${documentId}" failed permanently after ${job.attemptsMade + 1} attempt(s): ${(error as Error).message}`,
        );
        const document = await this.documentRepository.findById(documentId);
        if (document) {
          document.markFailed((error as Error).message);
          await this.documentRepository.save(document);
          for (const event of document.domainEvents) {
            this.eventEmitter.emit(event.eventName, event);
          }
          document.clearDomainEvents();
        }
      }
      throw error; // re-throw để BullMQ tự retry theo backoff đã cấu hình ở QueueModule
    }
  }
}
