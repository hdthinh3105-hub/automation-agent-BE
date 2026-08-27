import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@app/shared/decorators/public.decorator';
import { CreateTicketUseCase } from '../../application/use-cases/create-ticket.use-case';
import { EmailChannelAdapter } from '../../infrastructure/adapters/email-channel.adapter';

/**
 * Webhook nhận Inbound Route từ Mailgun (TDD Mục 5.3 —
 * EmailChannelAdapter, Could have). Public vì Mailgun gọi trực tiếp,
 * không có JWT — tương tự lý do bảo mật của TelegramWebhookController
 * (URL chỉ được biết bởi Mailgun sau khi cấu hình Inbound Route).
 *
 * Setup (làm 1 lần trên Mailgun Dashboard, free sandbox domain):
 * 1. Mailgun Dashboard -> Receiving -> Create Route
 * 2. Expression: match_recipient(".*@YOUR_SANDBOX_DOMAIN.mailgun.org")
 * 3. Action: Forward -> https://YOUR_PUBLIC_URL/api/webhooks/email
 * 4. Priority: 0, Active: yes
 *
 * Free sandbox domain chỉ nhận được email từ địa chỉ đã "authorize" thủ
 * công trong Mailgun Dashboard (giới hạn của sandbox, không phải lỗi
 * code) — đủ dùng để demo video, ghi rõ giới hạn này vào README khi bàn
 * giao (TDD Mục 17).
 */
@Controller('webhooks/email')
export class EmailWebhookController {
  constructor(
    private readonly emailChannelAdapter: EmailChannelAdapter,
    private readonly createTicketUseCase: CreateTicketUseCase,
  ) {}

  @Public()
  @Post()
  async handleInbound(@Body() payload: unknown): Promise<{ ok: true }> {
    try {
      const command = this.emailChannelAdapter.parseIncoming(payload as never);
      await this.createTicketUseCase.execute(command);
    } catch {
      // Payload không hợp lệ/không có nội dung đọc được — vẫn trả 200
      // để Mailgun không coi là lỗi và không retry vô hạn.
    }
    return { ok: true };
  }
}
