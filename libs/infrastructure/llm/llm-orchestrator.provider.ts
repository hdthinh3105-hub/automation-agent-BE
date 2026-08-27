import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';
import { GroqLlmProvider } from './groq/groq-llm.provider';
import { GeminiLlmProvider } from './gemini/gemini-llm.provider';
import {
  ILlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
} from './ports/llm-provider.port';

/**
 * 🎯 `LlmOrchestratorService` (TDD Mục 5.7/15) — implement `ILlmProvider`
 * nhưng bản thân là 1 lớp bọc chọn provider theo config + fallback chain
 * khi rate-limit/lỗi (Groq primary → Gemini fallback). Đây là adapter
 * DUY NHẤT mà Application layer (RAG/AI Module) nên inject qua token
 * `LLM_PROVIDER` — không inject thẳng `GroqLlmProvider`/`GeminiLlmProvider`
 * để đổi provider không cần sửa business logic (Open/Closed Principle).
 */
@Injectable()
export class LlmOrchestratorProvider implements ILlmProvider {
  public readonly providerName = 'orchestrator';
  private readonly logger = new Logger(LlmOrchestratorProvider.name);
  private readonly chain: ILlmProvider[];

  constructor(groq: GroqLlmProvider, gemini: GeminiLlmProvider) {
    this.chain = [groq, gemini];
  }

  async complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    return this.tryChain((provider) => provider.complete(messages, options));
  }

  async summarize(text: string, maxWords?: number): Promise<LlmCompletionResult> {
    return this.tryChain((provider) => provider.summarize(text, maxWords));
  }

  private async tryChain(
    call: (provider: ILlmProvider) => Promise<LlmCompletionResult>,
  ): Promise<LlmCompletionResult> {
    const errors: string[] = [];
    for (const provider of this.chain) {
      try {
        return await call(provider);
      } catch (error) {
        const message = (error as Error).message;
        this.logger.warn(
          `Provider "${provider.providerName}" failed, trying next in chain: ${message}`,
        );
        errors.push(`${provider.providerName}: ${message}`);
      }
    }
    throw new DomainException(
      ErrorCode.LLM_PROVIDER_ERROR,
      'All LLM providers in fallback chain failed',
      {
        errors,
      },
    );
  }
}
