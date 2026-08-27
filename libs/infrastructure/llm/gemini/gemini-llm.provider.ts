import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';
import {
  ILlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
} from '../ports/llm-provider.port';

/**
 * Adapter cho Google Gemini — TDD Mục 3, dùng làm fallback khi Groq bị
 * rate-limit/lỗi (xem `LlmOrchestratorProvider`). Gemini không có khái
 * niệm "system message" tách biệt như OpenAI/Groq — system prompt được
 * gộp vào đầu message đầu tiên của user.
 */
@Injectable()
export class GeminiLlmProvider implements ILlmProvider {
  public readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiLlmProvider.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.geminiApiKey');
    this.model = this.configService.get<string>('llm.geminiModel', 'gemini-flash-latest');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    if (!this.client) {
      throw new DomainException(ErrorCode.LLM_PROVIDER_ERROR, 'GEMINI_API_KEY is not configured', {
        provider: this.providerName,
      });
    }
    const startedAt = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content);
      const conversational = messages.filter((m) => m.role !== 'system');

      const prompt = [
        ...systemMessages,
        ...conversational.map((m) => `${m.role}: ${m.content}`),
      ].join('\n\n');

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 1024,
        },
      });
      const latencyMs = Date.now() - startedAt;
      const content = result.response.text();
      const usage = result.response.usageMetadata;
      return {
        content,
        provider: this.providerName,
        model: this.model,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        latencyMs,
      };
    } catch (error) {
      this.logger.warn(`Gemini call failed: ${(error as Error).message}`);
      throw new DomainException(ErrorCode.LLM_PROVIDER_ERROR, 'Gemini provider call failed', {
        provider: this.providerName,
        cause: (error as Error).message,
      });
    }
  }

  async summarize(text: string, maxWords = 150): Promise<LlmCompletionResult> {
    return this.complete([
      {
        role: 'system',
        content: `Tóm tắt đoạn hội thoại sau trong tối đa ${maxWords} từ, giữ lại thông tin quan trọng nhất. Chỉ trả về nội dung tóm tắt.`,
      },
      { role: 'user', content: text },
    ]);
  }
}
