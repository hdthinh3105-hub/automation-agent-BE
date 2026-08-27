import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';
import { IEmbeddingProvider } from '../ports/embedding-provider.port';

// `@xenova/transformers` là thư viện ESM-only — import động (dynamic
// `import()`) bên trong hàm async để tương thích với CommonJS build của
// NestJS (webpack bundle) mà không cần đổi toàn bộ project sang ESM.
type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

/**
 * Adapter mặc định cho Embedding (TDD Mục 3): chạy
 * `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, 50+ ngôn ngữ,
 * đúng tiếng Việt) local qua `@xenova/transformers`, KHÔNG cần API key,
 * không phụ thuộc rate-limit của bên thứ 3 — tiết kiệm quota free tier cho
 * phần generation (Groq/Gemini). Model (~470MB) được tải về + cache lần đầu
 * gọi (`./.transformers-cache`), các lần sau load từ cache. Pipeline được
 * khởi tạo 1 lần (singleton lazy-load) và tái dùng cho mọi request — tránh
 * nạp lại model mỗi lần embed (rất chậm/tốn RAM).
 */
@Injectable()
export class LocalEmbeddingProvider implements IEmbeddingProvider {
  private readonly logger = new Logger(LocalEmbeddingProvider.name);
  public readonly modelName: string;
  public readonly dimensions: number;

  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.modelName = this.configService.get<string>(
      'embedding.model',
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    );
    this.dimensions = this.configService.get<number>('embedding.dimensions', 384);
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        this.logger.log(
          `Loading local embedding model "${this.modelName}" (first call — may take a while)...`,
        );
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { pipeline, env } = await (Function(
          'return import("@xenova/transformers")',
        )() as Promise<typeof import('@xenova/transformers')>);
        env.cacheDir = './.transformers-cache';
        const extractor = await pipeline('feature-extraction', this.modelName);
        this.logger.log(`Local embedding model "${this.modelName}" loaded.`);
        return extractor as unknown as FeatureExtractionPipeline;
      })().catch((error) => {
        this.pipelinePromise = null;
        throw error;
      });
    }
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const extractor = await this.getPipeline();
      const results: number[][] = [];
      // Xử lý tuần tự từng text (thay vì batch native) để tránh OOM trên
      // free-tier RAM giới hạn (TDD Mục 15 — rủi ro RAM local embedding).
      for (const text of texts) {
        const output = await extractor([text], { pooling: 'mean', normalize: true });
        results.push(Array.from(output.data as Float32Array));
      }
      return results;
    } catch (error) {
      this.logger.error(`Local embedding failed: ${(error as Error).message}`);
      throw new DomainException(
        ErrorCode.EMBEDDING_PROVIDER_ERROR,
        'Local embedding provider failed',
        {
          provider: 'local',
          model: this.modelName,
          cause: (error as Error).message,
        },
      );
    }
  }
}
