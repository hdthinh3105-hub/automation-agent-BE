import { PromptLog as PrismaPromptLog } from '@prisma/client';
import { PromptLog } from '../../domain/entities/prompt-log.entity';

export class PromptLogMapper {
  static toDomain(record: PrismaPromptLog): PromptLog {
    return PromptLog.reconstitute({
      id: record.id,
      ticketId: record.ticketId,
      useCase: record.useCase,
      provider: record.provider,
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      latencyMs: record.latencyMs,
      requestPayloadRedacted: record.requestPayloadRedacted,
      responseRaw: record.responseRaw,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(promptLog: PromptLog) {
    return {
      id: promptLog.id,
      ticketId: promptLog.ticketId,
      useCase: promptLog.useCase,
      provider: promptLog.provider,
      model: promptLog.model,
      promptTokens: promptLog.promptTokens,
      completionTokens: promptLog.completionTokens,
      latencyMs: promptLog.latencyMs,
      requestPayloadRedacted: promptLog.requestPayloadRedacted,
      responseRaw: promptLog.responseRaw,
      createdAt: promptLog.createdAt,
    };
  }
}
