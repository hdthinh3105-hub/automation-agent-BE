import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure';
import { IChunkRepository, ChunkSearchResult } from '../../application/ports/chunk-repository.port';
import { KnowledgeChunk } from '../../domain/entities/knowledge-chunk.entity';
import { ChunkEmbedding } from '../../domain/entities/chunk-embedding.entity';
import { ChunkMapper } from './chunk.mapper';

interface RawChunkRow {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  section: string | null;
  createdAt: Date;
  documentTitle: string;
  score: number;
}

/**
 * Implement `IChunkRepository` (TDD Mục 5.6 🔌 IVectorStore). Phần ghi/đọc
 * cột `vector` (pgvector) và full-text search dùng raw SQL (`$queryRaw`/
 * `$executeRaw`) vì Prisma Client loại bỏ hoàn toàn field khai báo
 * `Unsupported("vector")` khỏi generated type, và Prisma không hỗ trợ
 * expression index/`to_tsvector` query builder sẵn (TDD Mục 7.2 bước
 * [6]/[7]/[8], Mục 10.3).
 */
@Injectable()
export class PrismaChunkRepository implements IChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMany(chunks: KnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await this.prisma.knowledgeChunk.createMany({
      data: chunks.map((chunk) => ChunkMapper.toPersistence(chunk)),
    });
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    const records = await this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
    return records.map((record) => ChunkMapper.toDomain(record));
  }

  async findChunksWithoutEmbedding(documentId: string): Promise<KnowledgeChunk[]> {
    const allChunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
    if (allChunks.length === 0) return [];

    // Không dựa vào cú pháp filter quan hệ 1-1 optional của Prisma (dễ
    // lệch giữa version) — lấy danh sách chunkId đã có embedding rồi
    // diff thủ công, an toàn và rõ ràng hơn.
    const embedded = await this.prisma.chunkEmbedding.findMany({
      where: { chunkId: { in: allChunks.map((c) => c.id) } },
      select: { chunkId: true },
    });
    const embeddedIds = new Set(embedded.map((e) => e.chunkId));

    return allChunks
      .filter((c) => !embeddedIds.has(c.id))
      .map((record) => ChunkMapper.toDomain(record));
  }

  async saveEmbedding(embedding: ChunkEmbedding): Promise<void> {
    const vectorLiteral = `[${embedding.vector.join(',')}]`;
    await this.prisma.$executeRaw`
      INSERT INTO chunk_embeddings (chunk_id, vector, embedding_model, dimensions, created_at)
      VALUES (${embedding.chunkId}, ${vectorLiteral}::vector, ${embedding.embeddingModel}, ${embedding.dimensions}, now())
      ON CONFLICT (chunk_id) DO UPDATE SET
        vector = EXCLUDED.vector,
        embedding_model = EXCLUDED.embedding_model,
        dimensions = EXCLUDED.dimensions,
        created_at = EXCLUDED.created_at
    `;
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    // ChunkEmbedding có onDelete: Cascade trên FK chunk_id -> xoá
    // KnowledgeChunk sẽ tự động xoá ChunkEmbedding tương ứng ở tầng DB.
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });
  }

  async vectorSearch(queryVector: number[], topK: number): Promise<ChunkSearchResult[]> {
    const vectorLiteral = `[${queryVector.join(',')}]`;
    const rows = await this.prisma.$queryRaw<RawChunkRow[]>`
      SELECT
        kc.id AS "id",
        kc.document_id AS "documentId",
        kc.content AS "content",
        kc.chunk_index AS "chunkIndex",
        kc.token_count AS "tokenCount",
        kc.section AS "section",
        kc.created_at AS "createdAt",
        kd.title AS "documentTitle",
        1 - (ce.vector <=> ${vectorLiteral}::vector) AS "score"
      FROM knowledge_chunks kc
      JOIN chunk_embeddings ce ON ce.chunk_id = kc.id
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.status = 'READY' AND kd.deleted_at IS NULL
      ORDER BY ce.vector <=> ${vectorLiteral}::vector ASC
      LIMIT ${topK}
    `;
    return rows.map((row) => this.toSearchResult(row));
  }

  async fullTextSearch(queryText: string, topK: number): Promise<ChunkSearchResult[]> {
    // Dùng to_tsvector('simple', ...) tại thời điểm query (không cần
    // cột generated + GIN index riêng ở Đợt này) — đủ dùng cho quy mô
    // dữ liệu Assessment; thêm generated column + GIN index là tối ưu
    // hiệu năng có thể làm sau nếu dữ liệu KB lớn (Should-have, TDD Mục
    // 14.1), không đổi API/behavior khi thêm sau.
    //
    // OR-tokens thay vì plainto_tsquery (AND mọi token): tiếng Việt
    // không có stemming, kỹ thuật AND làm loại bỏ chunk chứa đúng từ
    // khoá nòng cốt (VD "hoàn tiền") chỉ vì thiếu từ phụ ("bao lâu").
    const tokens = queryText
      .toLowerCase()
      .match(/[a-zA-Z0-9_À-ỹ]+/g)
      ?.filter((t, i, arr) => t.length >= 2 && arr.indexOf(t) === i)
      .slice(0, 15)
      .join(' | ');

    if (!tokens) return [];

    const rows = await this.prisma.$queryRaw<RawChunkRow[]>`
      SELECT
        kc.id AS "id",
        kc.document_id AS "documentId",
        kc.content AS "content",
        kc.chunk_index AS "chunkIndex",
        kc.token_count AS "tokenCount",
        kc.section AS "section",
        kc.created_at AS "createdAt",
        kd.title AS "documentTitle",
        ts_rank(to_tsvector('simple', kc.content), to_tsquery('simple', ${tokens})) AS "score"
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.status = 'READY' AND kd.deleted_at IS NULL
        AND to_tsvector('simple', kc.content) @@ to_tsquery('simple', ${tokens})
      ORDER BY "score" DESC
      LIMIT ${topK}
    `;
    return rows.map((row) => this.toSearchResult(row));
  }

  private toSearchResult(row: RawChunkRow): ChunkSearchResult {
    return {
      chunk: ChunkMapper.toDomain({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        tokenCount: row.tokenCount,
        section: row.section,
        createdAt: row.createdAt,
      }),
      documentTitle: row.documentTitle,
      score: Number(row.score),
    };
  }
}
