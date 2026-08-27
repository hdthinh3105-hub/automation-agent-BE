import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import {
  ITicketRepository,
  TICKET_REPOSITORY,
  Ticket,
  TicketStatus,
  TicketMessage,
  MessageSender,
} from '@app/modules/ticket';
import { AppendTurnUseCase, TurnRole } from '@app/modules/conversation';
import { GenerateAnswerUseCase } from '@app/modules/rag';
import { DetermineRoutingUseCase } from '@app/modules/routing';
import { CreateEscalationUseCase } from '@app/modules/escalation';
import { ClassificationService } from '../services/classification.service';
import { SpamDetectionService } from '../services/spam-detection.service';
import { DuplicateDetectionService } from '../services/duplicate-detection.service';
import { MissingInfoDetectionService } from '../services/missing-info-detection.service';
import { PriorityDetectionService } from '../services/priority-detection.service';
import { PromptLogService } from '../services/prompt-log.service';

export interface ProcessIncomingMessageResult {
  ticketId: string;
  finalStatus: TicketStatus;
  category: string | null;
  priority: string | null;
  isSpam: boolean;
  isDuplicate: boolean;
  missingInfoFlags: string[];
  confidence: number | null;
  answer: string | null;
  escalated: boolean;
}

/**
 * 🎯 `ProcessIncomingMessageUseCase` — orchestrator chính của AI Module
 * (TDD Mục 5.7/8): Classification -> Spam -> Duplicate -> Missing Info
 * -> Priority -> (Knowledge Retrieval + Answer Generation + Confidence
 * Evaluation qua RAG Module) -> Escalation Decision (Routing Module) ->
 * Auto Response hoặc Human Agent (Escalation Module). "Saga đơn giản,
 * đồng bộ trong 1 lần chạy" (TDD Mục 8).
 *
 * Bước RAG (Answer Generation) được bọc try/catch riêng: nếu TOÀN BỘ
 * LLM provider trong fallback chain đều lỗi (vd hết quota free-tier
 * Groq + Gemini cùng lúc — rủi ro đã ghi ở TDD Mục 15), pipeline KHÔNG
 * để ticket kẹt mãi ở CLASSIFIED mà tự động escalate cho Agent xử lý
 * thủ công, đúng tinh thần "nhận biết giới hạn của hệ thống" mà đề bài
 * yêu cầu — thay vì im lặng thất bại.
 */
@Injectable()
export class ProcessIncomingMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly appendTurnUseCase: AppendTurnUseCase,
    private readonly generateAnswerUseCase: GenerateAnswerUseCase,
    private readonly determineRoutingUseCase: DetermineRoutingUseCase,
    private readonly createEscalationUseCase: CreateEscalationUseCase,
    private readonly classificationService: ClassificationService,
    private readonly spamDetectionService: SpamDetectionService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly missingInfoDetectionService: MissingInfoDetectionService,
    private readonly priorityDetectionService: PriorityDetectionService,
    private readonly promptLogService: PromptLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(ticketId: string): Promise<ProcessIncomingMessageResult> {
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new Error(`Ticket "${ticketId}" not found`);
    }

    const messages = await this.ticketRepository.findMessages(ticketId);
    const lastCustomerMessage = [...messages]
      .reverse()
      .find((m) => m.sender === MessageSender.CUSTOMER);
    if (!lastCustomerMessage) {
      this.logger.warn(`Ticket "${ticketId}" has no customer message, skipping AI pipeline`);
      return this.buildResult(ticket, false, false, [], null, null, false);
    }
    const content = lastCustomerMessage.content;

    // ---- Bước 2: Spam Detection ----
    const spamResult = this.spamDetectionService.detect(content);
    if (spamResult.isSpam) {
      ticket.markSpamAndClose('system:ai_spam_detection');
      await this.ticketRepository.save(ticket);
      await this.dispatchEvents(ticket);
      this.logger.log(
        `Ticket "${ticketId}" marked as SPAM (score=${spamResult.score.toFixed(2)}), closed.`,
      );
      return this.buildResult(ticket, true, false, [], null, null, false);
    }

    // ---- Bước 1: Classification ----
    const classification = await this.classificationService.classify(content, ticketId);

    // ---- Bước 3: Duplicate Detection ----
    const duplicateResult = await this.duplicateDetectionService.detect(
      ticketId,
      ticket.customerId,
      content,
    );
    if (duplicateResult.isDuplicate && duplicateResult.duplicateOfTicketId) {
      ticket.markDuplicateOf(duplicateResult.duplicateOfTicketId);
    }

    // ---- Bước 4: Missing Information Detection ----
    const missingInfoFlags = this.missingInfoDetectionService.detect(
      classification.category,
      content,
    );

    // ---- Bước 5: Priority Detection ----
    const priority = this.priorityDetectionService.detect(classification.category, content);

    ticket.applyClassification(classification.category, priority);
    ticket.applyMissingInfoFlags(missingInfoFlags);

    this.transitionIfNeeded(ticket, TicketStatus.CLASSIFIED, 'system:ai_classification');

    if (missingInfoFlags.length > 0) {
      this.transitionIfNeeded(ticket, TicketStatus.WAITING_CUSTOMER, 'system:ai_missing_info');
      const askContent = this.buildMissingInfoPrompt(missingInfoFlags);
      const aiMessage = TicketMessage.create({
        id: uuid(),
        ticketId,
        sender: MessageSender.AI,
        content: askContent,
      });
      await this.ticketRepository.save(ticket);
      await this.ticketRepository.saveMessage(aiMessage);
      await this.appendTurnUseCase.execute(ticketId, TurnRole.ASSISTANT, askContent);
      await this.dispatchEvents(ticket);
      this.logger.log(
        `Ticket "${ticketId}" waiting for customer — missing info: ${missingInfoFlags.join(', ')}. Đã nhắc khách cung cấp thêm thông tin.`,
      );
      return this.buildResult(
        ticket,
        false,
        duplicateResult.isDuplicate,
        missingInfoFlags,
        null,
        askContent,
        false,
      );
    }

    if (duplicateResult.isDuplicate) {
      await this.ticketRepository.save(ticket);
      await this.escalate(
        ticket,
        'COMPLEX_CASE',
        `Duplicate of ticket ${duplicateResult.duplicateOfTicketId}`,
      );
      return this.buildResult(ticket, false, true, missingInfoFlags, null, null, true);
    }

    await this.ticketRepository.save(ticket);
    await this.dispatchEvents(ticket);

    // ---- Bước 6+7+8: Knowledge Retrieval + Answer Generation + Confidence (RAG Module) ----
    // Bọc try/catch riêng: nếu TOÀN BỘ LLM provider (Groq + Gemini) đều
    // lỗi (hết quota/rate-limit/model deprecated), KHÔNG để lỗi văng lên
    // làm ticket kẹt mãi ở CLASSIFIED — escalate ngay cho Agent, đúng
    // tinh thần "nhận biết giới hạn dữ liệu/độ tin cậy" của đề bài.
    const startedAt = Date.now();
    try {
      const answerResult = await this.generateAnswerUseCase.execute(content);
      void this.promptLogService.log({
        ticketId,
        useCase: 'rag_answer_generation',
        provider: answerResult.provider,
        model: answerResult.model,
        latencyMs: Date.now() - startedAt,
        responseRaw: answerResult.answer,
      });

      ticket.applyConfidenceScore(answerResult.confidence);
      await this.ticketRepository.save(ticket);

      // ---- Bước 9: Escalation Decision (Routing Module) ----
      const routingDecision = this.determineRoutingUseCase.execute({
        confidence: answerResult.confidence,
      });

      if (routingDecision.action === 'ESCALATE') {
        await this.escalate(ticket, 'LOW_CONFIDENCE', routingDecision.reason);
        const escalateContent = `${answerResult.answer}\n\n(Do độ chính xác có hạn, yêu cầu của bạn đã được chuyển cho nhân viên hỗ trợ và sẽ được phản hồi sớm nhất.)`;
        const escalateMessage = TicketMessage.create({
          id: uuid(),
          ticketId,
          sender: MessageSender.AI,
          content: escalateContent,
        });
        await this.ticketRepository.saveMessage(escalateMessage);
        await this.appendTurnUseCase.execute(ticketId, TurnRole.ASSISTANT, escalateContent);
        return this.buildResult(
          ticket,
          false,
          false,
          missingInfoFlags,
          answerResult.confidence,
          escalateContent,
          true,
        );
      }

      // ---- Bước 10+11: Auto Response ----
      this.transitionIfNeeded(ticket, TicketStatus.ANSWERED, 'system:ai_auto_answer');
      await this.ticketRepository.save(ticket);
      await this.dispatchEvents(ticket);

      const aiMessage = TicketMessage.create({
        id: uuid(),
        ticketId,
        sender: MessageSender.AI,
        content: answerResult.answer,
      });
      await this.ticketRepository.saveMessage(aiMessage);
      await this.appendTurnUseCase.execute(ticketId, TurnRole.ASSISTANT, answerResult.answer);

      this.logger.log(
        `Ticket "${ticketId}" auto-answered (confidence=${answerResult.confidence.toFixed(2)})`,
      );

      return this.buildResult(
        ticket,
        false,
        false,
        missingInfoFlags,
        answerResult.confidence,
        answerResult.answer,
        false,
      );
    } catch (error) {
      const reason = (error as Error).message;
      this.logger.error(
        `Ticket "${ticketId}": RAG Answer Generation thất bại hoàn toàn (mọi LLM provider lỗi), escalate thay vì để kẹt trạng thái. Chi tiết: ${reason}`,
      );
      void this.promptLogService.log({
        ticketId,
        useCase: 'rag_answer_generation_failed',
        provider: 'none',
        model: 'none',
        latencyMs: Date.now() - startedAt,
        responseRaw: reason,
      });
      await this.escalate(ticket, 'COMPLEX_CASE', `RAG pipeline failed: ${reason}`);
      return this.buildResult(ticket, false, false, missingInfoFlags, null, null, true);
    }
  }

  private buildMissingInfoPrompt(flags: string[]): string {
    if (flags.includes('MISSING_ORDER_CODE')) {
      return 'Để chúng tôi hỗ trợ chính xác nhất, bạn vui lòng cung cấp mã đơn hàng (dạng SV-xxxxxxxx).';
    }
    if (flags.includes('MISSING_ISSUE_DETAIL')) {
      return 'Để hỗ trợ tốt hơn, bạn vui lòng mô tả chi tiết hơn sự cố đang gặp phải (dấu hiệu, thời điểm, nội dung lỗi...).';
    }
    if (flags.includes('MISSING_COMPLAINT_DETAIL')) {
      return 'Chúng tôi rất tiếc vì trải nghiệm không tốt. Bạn vui lòng cho biết thêm chi tiết vấn đề để chúng tôi xử lý nhanh nhất.';
    }
    return 'Bạn vui lòng cung cấp thêm thông tin để chúng tôi hỗ trợ chính xác hơn.';
  }

  private transitionIfNeeded(ticket: Ticket, target: TicketStatus, actor: string): void {
    if (ticket.status === target) return;
    try {
      ticket.transitionTo(target, actor);
    } catch (error) {
      this.logger.warn(
        `Skipped transition ${ticket.status} -> ${target} for ticket "${ticket.id}": ${(error as Error).message}`,
      );
    }
  }

  private async escalate(ticket: Ticket, reason: string, note: string): Promise<void> {
    await this.createEscalationUseCase.execute({
      ticketId: ticket.id,
      reason,
      transitionTicket: ticket.status !== TicketStatus.ESCALATED,
    });
    this.logger.log(`Ticket "${ticket.id}" escalated (reason=${reason}): ${note}`);
  }

  private async dispatchEvents(ticket: Ticket): Promise<void> {
    for (const event of ticket.domainEvents) {
      this.eventEmitter.emit(event.eventName, event);
    }
    ticket.clearDomainEvents();
  }

  private buildResult(
    ticket: Ticket,
    isSpam: boolean,
    isDuplicate: boolean,
    missingInfoFlags: string[],
    confidence: number | null,
    answer: string | null,
    escalated: boolean,
  ): ProcessIncomingMessageResult {
    return {
      ticketId: ticket.id,
      finalStatus: ticket.status,
      category: ticket.category,
      priority: ticket.priority,
      isSpam,
      isDuplicate,
      missingInfoFlags,
      confidence,
      answer,
      escalated,
    };
  }
}
