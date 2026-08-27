import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_PROVIDER, IEmbeddingProvider } from '@app/infrastructure';
import {
  CHUNK_REPOSITORY,
  IChunkRepository,
  ChunkSearchResult,
} from '../ports/chunk-repository.port';

export interface HybridSearchResult extends ChunkSearchResult {
  /** Điểm RRF sau khi hợp nhất 2 nguồn tín hiệu — dùng để sắp xếp/re-rank. */
  combinedScore: number;
  vectorSimilarity: number | null;
}

const RRF_K = 60; // hằng số chuẩn cho Reciprocal Rank Fusion (không cần train)

/**
 * 🎯 `HybridSearchService` (TDD Mục 5.6/7.2 bước [7]+[8]) — embed câu hỏi
 * bằng CÙNG model đã dùng để index (đảm bảo bởi `EMBEDDING_PROVIDER`
 * đang active — guard ở Mục 7.2 bước [7] chỉ thật sự cần khi hệ thống hỗ
 * trợ NHIỀU embedding model cùng lúc, migration cho việc đó nằm ngoài
 * scope Đợt 2), sau đó kết hợp:
 * - **Vector similarity** (semantic, top-K theo cosine distance qua pgvector)
 * - **Full-text search** (`tsvector`/`ts_rank`, bắt từ khoá chính xác)
 * bằng **Reciprocal Rank Fusion (RRF)**: `score = Σ 1/(RRF_K + rank)` —
 * đơn giản, không cần train, hiệu quả tốt cho hybrid search.
 */
@Injectable()
export class HybridSearchService {
  private readonly topKRetrieval: number;

  constructor(
    @Inject(CHUNK_REPOSITORY) private readonly chunkRepository: IChunkRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: IEmbeddingProvider,
    configService: ConfigService,
  ) {
    this.topKRetrieval = configService.get<number>('rag.topKRetrieval', 15);
  }

  async search(queryText: string): Promise<HybridSearchResult[]> {
    const [queryVector] = await this.embeddingProvider.embed([queryText]);

    const [vectorResults, fullTextResults] = await Promise.all([
      this.chunkRepository.vectorSearch(queryVector, this.topKRetrieval),
      this.chunkRepository.fullTextSearch(queryText, this.topKRetrieval),
    ]);

    return this.reciprocalRankFusion(vectorResults, fullTextResults);
  }

  private reciprocalRankFusion(
    vectorResults: ChunkSearchResult[],
    fullTextResults: ChunkSearchResult[],
  ): HybridSearchResult[] {
    const merged = new Map<
      string,
      { result: ChunkSearchResult; combinedScore: number; vectorSimilarity: number | null }
    >();

    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      merged.set(result.chunk.id, {
        result,
        combinedScore: rrfScore,
        vectorSimilarity: result.score,
      });
    });

    fullTextResults.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = merged.get(result.chunk.id);
      if (existing) {
        existing.combinedScore += rrfScore;
      } else {
        merged.set(result.chunk.id, {
          result,
          combinedScore: rrfScore,
          vectorSimilarity: null,
        });
      }
    });

    return Array.from(merged.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map(({ result, combinedScore, vectorSimilarity }) => ({
        ...result,
        combinedScore,
        vectorSimilarity,
      }));
  }
}
