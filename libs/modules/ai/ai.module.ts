import { Global, Module } from '@nestjs/common';
import { TicketModule, AI_PIPELINE_TRIGGER } from '@app/modules/ticket';
import { ConversationModule } from '@app/modules/conversation';
import { RagModule } from '@app/modules/rag';
import { RoutingModule } from '@app/modules/routing';
import { EscalationModule } from '@app/modules/escalation';
import { PROMPT_LOG_REPOSITORY } from './application/ports/prompt-log-repository.port';
import { PrismaPromptLogRepository } from './infrastructure/repositories/prisma-prompt-log.repository';
import { PromptLogService } from './application/services/prompt-log.service';
import { ClassificationService } from './application/services/classification.service';
import { SpamDetectionService } from './application/services/spam-detection.service';
import { DuplicateDetectionService } from './application/services/duplicate-detection.service';
import { MissingInfoDetectionService } from './application/services/missing-info-detection.service';
import { PriorityDetectionService } from './application/services/priority-detection.service';
import { ProcessIncomingMessageUseCase } from './application/use-cases/process-incoming-message.use-case';
import { AiPipelineTriggerAdapter } from './infrastructure/ai-pipeline-trigger.adapter';
import { AiController } from './presentation/controllers/ai.controller';

/**
 * TDD Mục 5.7 — AI Module (Orchestration).
 *
 * `@Global()` áp dụng CHỈ cho mục đích export `AI_PIPELINE_TRIGGER` ra
 * toàn bộ DI container (giống cách `PrismaModule`/`LlmModule` đã làm ở
 * Phase 1/5) — lý do: `TicketModule.CreateTicketUseCase` cần resolve
 * được token này mà KHÔNG import ngược `AiModule` (tránh circular
 * dependency, vì `AiModule` đã import `TicketModule`). Đặt `AiModule`
 * SAU `TicketModule` trong mảng `imports` của `app.module.ts` để đảm
 * bảo thứ tự khởi tạo đúng (Nest build module graph theo thứ tự import,
 * `@Global()` provider chỉ khả dụng cho module import SAU nó — xem
 * `app.module.ts`).
 */
@Global()
@Module({
  imports: [TicketModule, ConversationModule, RagModule, RoutingModule, EscalationModule],
  controllers: [AiController],
  providers: [
    { provide: PROMPT_LOG_REPOSITORY, useClass: PrismaPromptLogRepository },
    PromptLogService,
    ClassificationService,
    SpamDetectionService,
    DuplicateDetectionService,
    MissingInfoDetectionService,
    PriorityDetectionService,
    ProcessIncomingMessageUseCase,
    { provide: AI_PIPELINE_TRIGGER, useClass: AiPipelineTriggerAdapter },
  ],
  exports: [ProcessIncomingMessageUseCase, AI_PIPELINE_TRIGGER],
})
export class AiModule {}
