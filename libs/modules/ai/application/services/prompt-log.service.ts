import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PROMPT_LOG_REPOSITORY, IPromptLogRepository } from '../ports/prompt-log-repository.port';
import { PromptLog } from '../../domain/entities/prompt-log.entity';

export interface LogPromptCallInput {
  ticketId?: string | null;
  useCase: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  responseRaw?: string;
}

/**
 * 🎯 Ghi `PromptLog` bất đồng bộ, không chặn luồng chính (TDD Mục 8 —
 * "ghi PromptLog/Audit được thực hiện bất đồng bộ qua Domain Event để
 * không làm chậm response time"). Nơi gọi dùng `void promptLogService
 * .log(...)` để không await; lỗi ghi log tự nuốt (catch nội bộ) để
 * không bao giờ làm sập pipeline AI chỉ vì lỗi audit phụ.
 */
@Injectable()
export class PromptLogService {
  private readonly logger = new Logger(PromptLogService.name);

  constructor(
    @Inject(PROMPT_LOG_REPOSITORY) private readonly promptLogRepository: IPromptLogRepository,
  ) {}

  async log(input: LogPromptCallInput): Promise<void> {
    try {
      const promptLog = PromptLog.create({
        id: uuid(),
        ticketId: input.ticketId,
        useCase: input.useCase,
        provider: input.provider,
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        latencyMs: input.latencyMs,
        responseRaw: input.responseRaw,
      });
      await this.promptLogRepository.save(promptLog);
    } catch (error) {
      this.logger.warn(`Failed to persist PromptLog (non-fatal): ${(error as Error).message}`);
    }
  }
}
