import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER, ILlmProvider } from '@app/infrastructure';
import { HybridSearchResult } from './hybrid-search.service';

/**
 * 🎯 `ReRankingService` (TDD Mục 5.6/7.2 bước [9]) — với top-N kết quả
 * hybrid (mặc định N=15), dùng chính LLM (Groq, rẻ/nhanh) để chấm điểm
 * relevance 0-10 cho từng chunk qua 1 prompt batch, lấy top-K sau re-rank
 * đưa vào prompt sinh câu trả lời.
 *
 * **Graceful degradation (đúng tinh thần TDD Mục 14 Ngày 3):** nếu LLM
 * chưa cấu hình key hoặc lỗi/rate-limit, service tự fallback về đúng thứ
 * tự RRF đã có (KHÔNG throw, KHÔNG chặn luồng trả lời) — vì Re-ranking
 * là bước tối ưu chất lượng, không phải bước bắt buộc để pipeline chạy.
 */
@Injectable()
export class ReRankingService {
  private readonly logger = new Logger(ReRankingService.name);
  private readonly topKFinal: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: ILlmProvider,
    configService: ConfigService,
  ) {
    this.topKFinal = configService.get<number>('rag.topKFinal', 5);
  }

  async rerank(query: string, candidates: HybridSearchResult[]): Promise<HybridSearchResult[]> {
    if (candidates.length === 0) return [];
    if (candidates.length <= this.topKFinal) return candidates;

    try {
      const scores = await this.scoreWithLlm(query, candidates);
      // Blend điểm LLM (0-1) với vector similarity để giảm rủi ro LLM
      // đánh giá lệch chunk về dưới ngưỡng trong khi mức tương đồng
      // ngữ nghĩa/từ khoá vẫn cao (VD chunk 6.3 "Hoàn tiền trong 3-5
      // ngày" với câu hỏi về hoàn tiền).
      return candidates
        .map((candidate, index) => {
          const llmScore01 = (scores[index] ?? 0) / 10;
          const vectorSimilarity = candidate.vectorSimilarity ?? 0;
          return { candidate, score: 0.6 * llmScore01 + 0.4 * vectorSimilarity };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, this.topKFinal)
        .map((item) => item.candidate);
    } catch (error) {
      this.logger.warn(
        `LLM re-ranking unavailable, falling back to RRF order: ${(error as Error).message}`,
      );
      return candidates.slice(0, this.topKFinal);
    }
  }

  private async scoreWithLlm(query: string, candidates: HybridSearchResult[]): Promise<number[]> {
    const numberedChunks = candidates
      .map((c, i) => `[${i}] ${c.chunk.content.slice(0, 500)}`)
      .join('\n\n');

    const result = await this.llmProvider.complete(
      [
        {
          role: 'system',
          content:
            'Bạn là bộ chấm điểm relevance. Cho câu hỏi và danh sách đoạn văn bản đánh số [0]..[n], ' +
            'chấm điểm mức độ liên quan của TỪNG đoạn với câu hỏi theo thang 0-10 (0 = không liên quan, ' +
            '10 = trả lời trực tiếp câu hỏi). CHỈ trả về JSON dạng mảng số, ví dụ: [7,2,9,0]. ' +
            'Độ dài mảng PHẢI bằng đúng số đoạn văn bản được đưa vào, không thêm giải thích.',
        },
        { role: 'user', content: `Câu hỏi: ${query}\n\nCác đoạn văn bản:\n${numberedChunks}` },
      ],
      { temperature: 0, maxTokens: 200 },
    );

    const parsed = JSON.parse(this.extractJsonArray(result.content));
    if (!Array.isArray(parsed) || parsed.length !== candidates.length) {
      throw new Error('LLM re-rank response shape mismatch');
    }
    return parsed.map((n: unknown) => Number(n));
  }

  private extractJsonArray(text: string): string {
    const match = text.match(/\[[\d\s,.-]*\]/);
    if (!match) throw new Error('No JSON array found in LLM re-rank response');
    return match[0];
  }
}
