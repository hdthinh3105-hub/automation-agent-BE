import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  IKnowledgeDocumentRepository,
} from '@app/modules/knowledge-base';
import { DocumentNotFoundException } from '@app/modules/knowledge-base';
import { CHUNK_REPOSITORY, IChunkRepository } from '../ports/chunk-repository.port';
import { ChunkingService } from '../services/chunking.service';
import { DocumentTextExtractorService } from '../services/document-text-extractor.service';
import { KnowledgeChunk } from '../../domain/entities/knowledge-chunk.entity';
import { DocumentEmptyContentException } from '../../domain/exceptions/rag.exception';

/**
 * 🎯 Use Case — bước [2]+[3]+[4] của RAG Pipeline (TDD Mục 7.2): nhận
 * `documentId` (từ BullMQ job `document-parser`), extract text, chunk,
 * lưu `KnowledgeChunk`. KHÔNG tự embed — đó là `EmbedChunksUseCase`
 * (bước [5]), enqueue riêng bởi `JobsProcessor` sau khi hàm
 * này chạy xong (giữ đúng ranh giới 2 Worker độc lập, TDD Mục 12).
 */
@Injectable()
export class ChunkDocumentUseCase {
  private readonly logger = new Logger(ChunkDocumentUseCase.name);

  constructor(
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY)
    private readonly documentRepository: IKnowledgeDocumentRepository,
    @Inject(CHUNK_REPOSITORY) private readonly chunkRepository: IChunkRepository,
    private readonly chunkingService: ChunkingService,
    private readonly textExtractor: DocumentTextExtractorService,
  ) {}

  /** @returns số lượng chunk đã tạo */
  async execute(documentId: string): Promise<number> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new DocumentNotFoundException(documentId);
    }
    if (!document.filePath) {
      throw new DocumentEmptyContentException(documentId);
    }

    document.startProcessing();
    await this.documentRepository.save(document);

    const rawText = await this.textExtractor.extract(document.filePath);
    const rawChunks = this.chunkingService.chunk(rawText);
    if (rawChunks.length === 0) {
      throw new DocumentEmptyContentException(documentId);
    }

    // Xoá chunk cũ (nếu là reprocess) để tránh trùng lặp dữ liệu.
    await this.chunkRepository.deleteByDocumentId(documentId);

    const chunks = rawChunks.map((raw, index) =>
      KnowledgeChunk.create({
        id: uuid(),
        documentId,
        content: raw.content,
        chunkIndex: index,
        section: raw.section,
      }),
    );
    await this.chunkRepository.saveMany(chunks);

    this.logger.log(`Document "${documentId}" chunked into ${chunks.length} chunk(s).`);
    return chunks.length;
  }
}
