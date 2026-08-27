import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';
import { IEmbeddingProvider } from '../ports/embedding-provider.port';

/**
 * Adapter thay thế cho Embedding — Google `gemini-embedding-001` (3072
 * chiều), dùng khi cấu hình `EMBEDDING_PROVIDER=gemini` (TDD Mục 3, ưu
 * tiên `local` mặc định để tiết kiệm quota). Cần `GEMINI_API_KEY`. Lưu
 * ý: `text-embedding-004`/`text-embedding-005` đã bị Google kill (404),
 * thay bằng `gemini-embedding-001` kèm `EMBEDDING_DIMENSIONS=3072`.
 */
@Injectable()
export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  private readonly logger = new Logger(GeminiEmbeddingProvider.name);
  public readonly modelName = 'gemini-embedding-001';
  public readonly dimensions = 3072;
  private readonly client: GoogleGenerativeAI | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.geminiApiKey');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.client) {
      throw new DomainException(
        ErrorCode.EMBEDDING_PROVIDER_ERROR,
        'GEMINI_API_KEY is not configured',
        {
          provider: 'gemini',
        },
      );
    }
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const results: number[][] = [];
      for (const text of texts) {
        const res = await model.embedContent(text);
        results.push(res.embedding.values);
      }
      return results;
    } catch (error) {
      this.logger.error(`Gemini embedding failed: ${(error as Error).message}`);
      throw new DomainException(
        ErrorCode.EMBEDDING_PROVIDER_ERROR,
        'Gemini embedding provider failed',
        {
          provider: 'gemini',
          cause: (error as Error).message,
        },
      );
    }
  }
}
