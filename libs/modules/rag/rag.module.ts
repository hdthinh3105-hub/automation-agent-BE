import { Module } from '@nestjs/common';
import { LlmModule } from '@app/infrastructure';
import { KnowledgeBaseModule } from '@app/modules/knowledge-base';
import { CHUNK_REPOSITORY } from './application/ports/chunk-repository.port';
import { PrismaChunkRepository } from './infrastructure/repositories/prisma-chunk.repository';
import { ChunkingService } from './application/services/chunking.service';
import { DocumentTextExtractorService } from './application/services/document-text-extractor.service';
import { HybridSearchService } from './application/services/hybrid-search.service';
import { ReRankingService } from './application/services/re-ranking.service';
import { PromptBuilderService } from './application/services/prompt-builder.service';
import { ConfidenceScoringService } from './application/services/confidence-scoring.service';
import { ChunkDocumentUseCase } from './application/use-cases/chunk-document.use-case';
import { EmbedChunksUseCase } from './application/use-cases/embed-chunks.use-case';
import { RetrieveRelevantChunksUseCase } from './application/use-cases/retrieve-relevant-chunks.use-case';
import { GenerateAnswerUseCase } from './application/use-cases/generate-answer.use-case';
import { DocumentUploadedListener } from './application/listeners/document-uploaded.listener';
import { RagController } from './presentation/controllers/rag.controller';

/**
 * TDD Mục 5.6 — RAG Module.
 * - Đợt 1 (Ngày 3): hạ tầng chunk + embed (Document Parser/Embedding Worker).
 * - Đợt 2 (Ngày 3): Hybrid Search + Re-ranking + Prompt Builder +
 *   Confidence Scoring + `GenerateAnswerUseCase` + endpoint `/rag/query`.
 *
 * `LlmModule` được import TƯỜNG MINH ở đây (dù bản thân nó `@Global()`)
 * — @Global() trong NestJS chỉ có hiệu lực SAU KHI module đó được import
 * ít nhất 1 lần vào cây module của ứng dụng; nếu không import ở đâu cả,
 * provider bên trong (LLM_PROVIDER/EMBEDDING_PROVIDER) không hề tồn tại,
 * dẫn tới lỗi "Nest can't resolve dependencies". Đặt import ở đây (thay
 * vì rải ở apps/api và apps/worker) đảm bảo LlmModule LUÔN có mặt bất kỳ
 * process nào import RagModule, không phải nhớ thêm ở từng app riêng.
 *
 * Import `KnowledgeBaseModule` để dùng `IKnowledgeDocumentRepository` qua
 * DI token đã export (KHÔNG import thẳng Repository/Entity nội bộ bằng
 * đường dẫn riêng — Modular Monolith TDD Mục 2.4: giao tiếp giữa module
 * chỉ qua Facade/token export tường minh).
 */
@Module({
  imports: [LlmModule, KnowledgeBaseModule],
  controllers: [RagController],
  providers: [
    { provide: CHUNK_REPOSITORY, useClass: PrismaChunkRepository },
    ChunkingService,
    DocumentTextExtractorService,
    HybridSearchService,
    ReRankingService,
    PromptBuilderService,
    ConfidenceScoringService,
    ChunkDocumentUseCase,
    EmbedChunksUseCase,
    RetrieveRelevantChunksUseCase,
    GenerateAnswerUseCase,
    DocumentUploadedListener,
  ],
  exports: [
    CHUNK_REPOSITORY,
    ChunkDocumentUseCase,
    EmbedChunksUseCase,
    RetrieveRelevantChunksUseCase,
    GenerateAnswerUseCase,
  ],
})
export class RagModule {}
