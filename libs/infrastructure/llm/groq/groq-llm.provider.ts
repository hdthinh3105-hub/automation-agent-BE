import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';
import {
  ILlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
} from '../ports/llm-provider.port';

/**
 * Adapter cho Groq (Llama 3.3 free tier) — TDD Mục 3, primary LLM
 * provider vì tốc độ suy luận rất nhanh. Không throw khi thiếu API key
 * lúc khởi tạo (để không chặn boot cả app chỉ vì thiếu key) — chỉ throw
 * khi thực sự bị gọi (`complete()`/`summarize()`), đúng nguyên tắc
 * "fail-fast khi dùng, không fail-fast khi boot" cho các module optional.
 */
@Injectable()
export class GroqLlmProvider implements ILlmProvider {
  public readonly providerName = 'groq';
  private readonly logger = new Logger(GroqLlmProvider.name);
  private readonly client: Groq | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.groqApiKey');
    this.model = this.configService.get<string>('llm.groqModel', 'openai/gpt-oss-120b');
    this.client = apiKey ? new Groq({ apiKey }) : null;
  }

  async complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    if (!this.client) {
      throw new DomainException(ErrorCode.LLM_PROVIDER_ERROR, 'GROQ_API_KEY is not configured', {
        provider: this.providerName,
      });
    }
    const startedAt = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1024,
      });
      const latencyMs = Date.now() - startedAt;
      const content = response.choices[0]?.message?.content ?? '';
      return {
        content,
        provider: this.providerName,
        model: this.model,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        latencyMs,
      };
    } catch (error) {
      this.logger.warn(`Groq call failed: ${(error as Error).message}`);
      throw new DomainException(ErrorCode.LLM_PROVIDER_ERROR, 'Groq provider call failed', {
        provider: this.providerName,
        cause: (error as Error).message,
      });
    }
  }

  async summarize(text: string, maxWords = 150): Promise<LlmCompletionResult> {
    return this.complete([
      {
        role: 'system',
        content: `Tóm tắt đoạn hội thoại sau trong tối đa ${maxWords} từ, giữ lại thông tin quan trọng nhất (yêu cầu của khách, thông tin đã cung cấp, trạng thái xử lý hiện tại). Chỉ trả về nội dung tóm tắt, không thêm lời dẫn.`,
      },
      { role: 'user', content: text },
    ]);
  }
}
