import { Controller, Param, Post } from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import {
  ProcessIncomingMessageUseCase,
  ProcessIncomingMessageResult,
} from '../../application/use-cases/process-incoming-message.use-case';

/**
 * `/ai/process/:ticketId` — TDD Mục 5.7: "AiController (/ai/process —
 * dùng nội bộ/test), thông thường được gọi từ Ticket Module qua Facade
 * khi có message mới." Đợt Ngày 4 CHƯA nối tự động qua domain event
 * `ticket.created`/`ticket.customer_message_added` (điều này đòi hỏi
 * TicketModule phải phụ thuộc AiModule, phá vỡ hướng phụ thuộc 1 chiều
 * hiện có — AiModule phụ thuộc TicketModule, không ngược lại). Vì vậy,
 * endpoint này expose để test tay VÀ để `CreateTicketUseCase`/
 * `AddCustomerMessageUseCase` gọi qua HTTP nội bộ nếu cần, còn cách nối
 * "sạch" hơn (Application Service Facade export từ AiModule, TicketModule
 * import ngược lại) sẽ làm ở Phase sau khi cấu trúc module ổn định hơn —
 * ghi rõ vào Nhật ký quyết định (TDD Mục 17).
 */
@Controller('ai')
export class AiController {
  constructor(private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase) {}

  @Post('process/:ticketId')
  @Roles(Role.ADMIN, Role.AGENT)
  async process(@Param('ticketId') ticketId: string): Promise<ProcessIncomingMessageResult> {
    return this.processIncomingMessageUseCase.execute(ticketId);
  }
}
