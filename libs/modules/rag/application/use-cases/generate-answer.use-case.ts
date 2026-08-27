import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LLM_PROVIDER, ILlmProvider } from '@app/infrastructure';
import { RetrieveRelevantChunksUseCase } from './retrieve-relevant-chunks.use-case';
import { PromptBuilderService } from '../services/prompt-builder.service';
import { ConfidenceScoringService } from '../services/confidence-scoring.service';
import { AnswerWithCitationDto } from '../dto/rag-query.dto';
import { AnswerGeneratedEvent, LowConfidenceAnswerEvent } from '../../domain/events/rag.events';

const NO_INFO_ANSWER =
  'Xin lỗi, tôi không tìm thấy đủ thông tin trong tài liệu hiện có để trả lời chính xác câu hỏi này.';

/**
 * 🎯 Use Case chính của Đợt 2 — bước [10]+[11]+[12]+[13] RAG Pipeline
 * (TDD Mục 5.6/7.2): Prompt Construction → LLM Answer Generation →
 * Citation Attachment + Confidence Scoring → Fallback Strategy nếu
 * confidence thấp hoặc không tìm được chunk liên quan (KHÔNG để LLM tự
 * bịa — trả thẳng câu "không đủ thông tin" mà không gọi LLM khi retrieval
 * rỗng, đúng yêu cầu đề bài về nhận biết giới hạn dữ liệu).
 */
@Injectable()
export class GenerateAnswerUseCase {
  private readonly logger = new Logger(GenerateAnswerUseCase.name);
  private readonly topKFinal: number;
  private readonly confidenceThreshold: number;

  constructor(
    private readonly retrieveRelevantChunksUseCase: RetrieveRelevantChunksUseCase,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly confidenceScoringService: ConfidenceScoringService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: ILlmProvider,
    private readonly eventEmitter: EventEmitter2,
    configService: ConfigService,
  ) {
    this.topKFinal = configService.get<number>('rag.topKFinal', 5);
    this.confidenceThreshold = configService.get<number>('rag.confidenceEscalationThreshold', 0.6);
  }

  async execute(query: string): Promise<AnswerWithCitationDto> {
    const startedAt = Date.now();
    const chunks = await this.retrieveRelevantChunksUseCase.execute(query);

    // TDD Mục 7.2 bước [13]: retrieval rỗng -> KHÔNG gọi LLM, trả thẳng
    // "không tìm thấy thông tin" để tránh hallucination + escalate luôn.
    if (chunks.length === 0) {
      this.eventEmitter.emit(
        'rag.low_confidence_answer',
        new LowConfidenceAnswerEvent(query, 0, 'NO_RELEVANT_CONTENT'),
      );
      return {
        answer: NO_INFO_ANSWER,
        citations: [],
        confidence: 0,
        confidenceBreakdown: { avgTopSimilarity: 0, retrievalCoverage: 0, llmSelfScore: 0 },
        needsEscalation: true,
        provider: 'none',
        model: 'none',
        latencyMs: Date.now() - startedAt,
      };
    }

    const { messages, citations } = this.promptBuilderService.build(query, chunks);
    const llmResult = await this.llmProvider.complete(messages, {
      temperature: 0.2,
      maxTokens: 800,
    });

    const { cleanedAnswer, selfScore } = this.confidenceScoringService.parseLlmSelfScore(
      llmResult.content,
    );
    const confidenceBreakdown = this.confidenceScoringService.score({
      usedChunks: chunks,
      topKFinal: this.topKFinal,
      llmSelfScore: selfScore,
    });

    const needsEscalation = confidenceBreakdown.score < this.confidenceThreshold;

    this.eventEmitter.emit(
      'rag.answer_generated',
      new AnswerGeneratedEvent(
        query,
        confidenceBreakdown.score,
        chunks.map((c) => c.chunk.id),
      ),
    );
    if (needsEscalation) {
      this.eventEmitter.emit(
        'rag.low_confidence_answer',
        new LowConfidenceAnswerEvent(query, confidenceBreakdown.score, 'BELOW_THRESHOLD'),
      );
      this.logger.log(
        `Query "${query}" answered with low confidence (${confidenceBreakdown.score.toFixed(2)}) -> needsEscalation=true`,
      );
    }

    return {
      answer: cleanedAnswer,
      citations,
      confidence: confidenceBreakdown.score,
      confidenceBreakdown: {
        avgTopSimilarity: confidenceBreakdown.avgTopSimilarity,
        retrievalCoverage: confidenceBreakdown.retrievalCoverage,
        llmSelfScore: confidenceBreakdown.llmSelfScore,
      },
      needsEscalation,
      provider: llmResult.provider,
      model: llmResult.model,
      latencyMs: llmResult.latencyMs,
    };
  }
}
