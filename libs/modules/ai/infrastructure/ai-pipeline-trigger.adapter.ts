import { Injectable } from '@nestjs/common';
import { IAiPipelineTrigger } from '@app/modules/ticket';
import { ProcessIncomingMessageUseCase } from '../application/use-cases/process-incoming-message.use-case';

/**
 * Adapter implement `IAiPipelineTrigger` (port do TicketModule định
 * nghĩa) bằng cách gọi lại `ProcessIncomingMessageUseCase` thật của
 * AiModule. Đăng ký binding này ở `app.module.ts` (Composition Root) —
 * đây là chỗ DUY NHẤT 2 module "gặp nhau", giữ đúng hướng phụ thuộc 1
 * chiều AiModule -> TicketModule mà TicketModule vẫn kích hoạt được AI
 * pipeline (TDD Mục 2.2 — Dependency Inversion).
 */
@Injectable()
export class AiPipelineTriggerAdapter implements IAiPipelineTrigger {
  constructor(private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase) {}

  async process(ticketId: string): Promise<unknown> {
    return this.processIncomingMessageUseCase.execute(ticketId);
  }
}
