import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOBS_QUEUE, JOB_PARSE_DOCUMENT, DocumentParserJobData } from '@app/infrastructure';
import { DocumentUploadedEvent } from '@app/modules/knowledge-base';

/**
 * Cầu nối Domain Event (đồng bộ, in-process, TDD Mục 2.6) → BullMQ Job
 * (bất đồng bộ, chạy ở Worker process). KnowledgeBaseModule chỉ biết
 * "tài liệu đã upload xong" (phát `DocumentUploadedEvent`) — KHÔNG biết
 * gì về chunk/embedding (đúng ranh giới TDD Mục 5.5: KB Module không
 * chứa logic vector). RAG Module lắng nghe và tự quyết định enqueue job.
 */
@Injectable()
export class DocumentUploadedListener {
  private readonly logger = new Logger(DocumentUploadedListener.name);

  constructor(
    @InjectQueue(JOBS_QUEUE) private readonly queue: Queue<DocumentParserJobData>,
  ) {}

  @OnEvent('knowledge_base.document_uploaded')
  async handle(event: DocumentUploadedEvent): Promise<void> {
    this.logger.log(`Enqueuing document-parser job for document "${event.documentId}"`);
    await this.queue.add(
      JOB_PARSE_DOCUMENT,
      { documentId: event.documentId },
      // Giữ nguyên semantics cũ của queue document-parser: retry 3 lần,
      // backoff exponential 2s (trước đây khai báo ở QueueModule).
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );
  }
}
