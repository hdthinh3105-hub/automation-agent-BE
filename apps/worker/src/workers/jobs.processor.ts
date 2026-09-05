import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job, Queue } from 'bullmq';
import {
  JOBS_QUEUE,
  JOB_PARSE_DOCUMENT,
  JOB_EMBED_CHUNKS,
  JOB_SEND_EMAIL,
  JOB_SEND_NOTIFICATION,
  DocumentParserJobData,
  EmbeddingJobData,
  EmailJobData,
  NotificationJobData,
} from '@app/infrastructure';
import { ChunkDocumentUseCase, EmbedChunksUseCase } from '@app/modules/rag';
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  IKnowledgeDocumentRepository,
} from '@app/modules/knowledge-base';
import { GmailChannelAdapter } from '@app/modules/ticket';
import {
  NOTIFICATION_LOG_REPOSITORY,
  INotificationLogRepository,
  NotificationDispatcherService,
} from '@app/modules/notification';

/**
 * Worker duy nhất của queue `jobs` (gộp từ 4 processor cũ:
 * document-parser/embedding/email/notification) — phân loại việc theo
 * `job.name`, giữ nguyên toàn bộ logic từng handler cũ.
 *
 * Lý do gộp: Upstash free-tier 500k lệnh/tháng — mỗi worker idle vẫn
 * long-poll Redis mỗi `drainDelay` giây, 1 worker rẻ hơn 4 worker nhiều
 * (drain 300s ≈ 1.2K lệnh/tháng lúc rỗng). Job mới vẫn được đánh thức
 * ngay qua pub/sub, không chờ hết drain. `lockDuration` giữ 10 phút
 * (mức cao nhất của các job cũ) để job embed nhiều chunk qua Gemini
 * không dính "Missing lock for job".
 */
@Processor(JOBS_QUEUE, {
  drainDelay: 300,
  stalledInterval: 300_000,
  lockDuration: 600_000,
})
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly chunkDocumentUseCase: ChunkDocumentUseCase,
    private readonly embedChunksUseCase: EmbedChunksUseCase,
    @InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue,
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY)
    private readonly documentRepository: IKnowledgeDocumentRepository,
    private readonly gmailChannelAdapter: GmailChannelAdapter,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly notificationLogRepository: INotificationLogRepository,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_PARSE_DOCUMENT:
        return this.handleParse(job as Job<DocumentParserJobData>);
      case JOB_EMBED_CHUNKS:
        return this.handleEmbed(job as Job<EmbeddingJobData>);
      case JOB_SEND_EMAIL:
        return this.handleSendEmail(job as Job<EmailJobData>);
      case JOB_SEND_NOTIFICATION:
        return this.handleSendNotification(job as Job<NotificationJobData>);
      default:
        this.logger.warn(`[job ${job.id}] Unknown job name "${job.name}", skipping.`);
        return undefined;
    }
  }

  private async handleParse(job: Job<DocumentParserJobData>): Promise<{ chunkCount: number }> {
    const { documentId } = job.data;
    this.logger.log(
      `[job ${job.id}] Parsing + chunking document "${documentId}" (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const chunkCount = await this.chunkDocumentUseCase.execute(documentId);
      await this.jobsQueue.add(
        JOB_EMBED_CHUNKS,
        { documentId },
        // Giữ nguyên semantics cũ của queue embedding: retry 5 lần
        // (API rate-limit dễ gặp hơn), backoff exponential 5s.
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      );
      this.logger.log(
        `[job ${job.id}] Document "${documentId}" chunked (${chunkCount} chunk(s)), embedding job enqueued.`,
      );
      return { chunkCount };
    } catch (error) {
      await this.markDocumentFailed(job, documentId, error as Error);
      throw error; // re-throw để BullMQ tự retry theo backoff
    }
  }

  private async handleEmbed(job: Job<EmbeddingJobData>): Promise<{ embeddedCount: number }> {
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
      await this.markDocumentFailed(job, documentId, error as Error);
      throw error;
    }
  }

  private async handleSendEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, text } = job.data;
    this.logger.log(`[job ${job.id}] Gửi email tới ${to} (attempt ${job.attemptsMade + 1})`);

    try {
      await this.gmailChannelAdapter.sendMailDirect(to, subject, text);
      this.logger.log(`[job ${job.id}] Gửi email tới ${to} thành công.`);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        this.logger.error(
          `[job ${job.id}] Gửi email tới ${to} THẤT BẠI VĨNH VIỄN sau ${job.attemptsMade + 1} lần thử: ${(error as Error).message}`,
        );
      } else {
        this.logger.warn(
          `[job ${job.id}] Gửi email tới ${to} thất bại (lần ${job.attemptsMade + 1}/${maxAttempts}), sẽ retry: ${(error as Error).message}`,
        );
      }
      throw error; // để BullMQ tự retry theo defaultJobOptions
    }
  }

  private async handleSendNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationLogId } = job.data;
    const log = await this.notificationLogRepository.findById(notificationLogId);
    if (!log) {
      this.logger.warn(`NotificationLog "${notificationLogId}" not found, skipping.`);
      return;
    }

    try {
      await this.dispatcher.dispatch(log.channel, log.type, log.recipient, log.payload);
      log.markSent();
      await this.notificationLogRepository.save(log);
      this.logger.log(`Đã gửi notification "${log.type}" tới ${log.recipient}`);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        log.markFailed((error as Error).message);
        await this.notificationLogRepository.save(log);
      }
      throw error;
    }
  }

  /** Đánh dấu document FAILED ở lần thử cuối (giữ nguyên logic 2 processor RAG cũ). */
  private async markDocumentFailed(
    job: Job<DocumentParserJobData> | Job<EmbeddingJobData>,
    documentId: string,
    error: Error,
  ): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
    if (!isLastAttempt) return;

    this.logger.error(
      `[job ${job.id}] Document "${documentId}" failed permanently after ${job.attemptsMade + 1} attempt(s): ${error.message}`,
    );
    const document = await this.documentRepository.findById(documentId);
    if (document) {
      document.markFailed(error.message);
      await this.documentRepository.save(document);
      for (const event of document.domainEvents) {
        this.eventEmitter.emit(event.eventName, event);
      }
      document.clearDomainEvents();
    }
  }
}
