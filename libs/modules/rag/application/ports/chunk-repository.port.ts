import { KnowledgeChunk } from '../../domain/entities/knowledge-chunk.entity';
import { ChunkEmbedding } from '../../domain/entities/chunk-embedding.entity';

export const CHUNK_REPOSITORY = Symbol('CHUNK_REPOSITORY');

/**
 * Kết quả tìm kiếm 1 chunk kèm điểm số từ 1 nguồn tín hiệu (vector
 * similarity HOẶC full-text rank — TDD Mục 7.2 bước [8]). `documentTitle`
 * đi kèm để Prompt Builder/Citation không phải join lại lần 2.
 */
export interface ChunkSearchResult {
  chunk: KnowledgeChunk;
  documentTitle: string;
  /** Cosine similarity (0..1, cao hơn = liên quan hơn) nếu là vectorSearch, hoặc ts_rank nếu là fullTextSearch. */
  score: number;
}

/**
 * 🔌 Port — Application layer định nghĩa, `PrismaChunkRepository`
 * (Infrastructure) implement bằng raw SQL cho phần vector (Prisma Client
 * chưa hỗ trợ thao tác `Unsupported("vector")` trực tiếp — TDD Mục 7.2
 * bước [6]/[7]/[8], Mục 10.3).
 */
export interface IChunkRepository {
  saveMany(chunks: KnowledgeChunk[]): Promise<void>;
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  findChunksWithoutEmbedding(documentId: string): Promise<KnowledgeChunk[]>;
  saveEmbedding(embedding: ChunkEmbedding): Promise<void>;
  /** Xoá toàn bộ chunk + embedding cũ của 1 document — dùng khi reprocess (TDD Mục 5.5). */
  deleteByDocumentId(documentId: string): Promise<void>;

  /** Semantic search — cosine distance qua pgvector (`<=>`), chỉ tìm trong document status=READY. */
  vectorSearch(queryVector: number[], topK: number): Promise<ChunkSearchResult[]>;
  /** Keyword search — Postgres full-text (`tsvector`/`ts_rank`), bắt các từ khoá chính xác (mã lỗi, mã đơn hàng...). */
  fullTextSearch(queryText: string, topK: number): Promise<ChunkSearchResult[]>;
}
