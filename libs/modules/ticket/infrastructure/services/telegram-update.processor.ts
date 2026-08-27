import { Injectable } from '@nestjs/common';
import { CreateTicketUseCase } from '../../application/use-cases/create-ticket.use-case';
import { GetTicketDetailUseCase } from '../../application/use-cases/ticket-queries.use-case';
import { TelegramChannelAdapter } from '../adapters/telegram-channel.adapter';

/**
 * Xử lý 1 update Telegram (message từ khách): parse -> tạo ticket (chạy
 * AI pipeline đồng bộ) -> đọc trạng thái mới nhất -> gửi phản hồi cho
 * khách qua Bot API `sendMessage`.
 *
 * Dùng CHUNG cho 2 nguồn update:
 * - `TelegramWebhookController` (cần URL public — Render) khi deploy.
 * - `TelegramPollingService` (long-poll `getUpdates` — không cần URL,
 *   dành cho chạy local/Docker không có domain công khai).
 */
@Injectable()
export class TelegramUpdateProcessor {
  constructor(
    private readonly telegramChannelAdapter: TelegramChannelAdapter,
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly getTicketDetailUseCase: GetTicketDetailUseCase,
  ) {}

  async handleUpdate(update: unknown): Promise<void> {
    let chatId: number | string | undefined;
    try {
      const command = this.telegramChannelAdapter.parseIncoming(update as never);
      chatId = (command.channelMetadata as { telegramChatId?: number | string })?.telegramChatId;

      const ticket = await this.createTicketUseCase.execute(command);

      if (chatId) {
        const replyText = await this.buildReplyText(ticket.id, ticket.status);
        await this.telegramChannelAdapter.sendMessage(chatId, replyText);
      }
    } catch {
      // Update không chứa tin nhắn văn bản (sticker, join event...) hoặc
      // lỗi khác — bỏ qua, không retry. Với polling, cập nhật đã được
      // đánh dấu offset nên không xuất hiện lại.
      if (chatId) {
        await this.telegramChannelAdapter.sendMessage(
          chatId,
          'Xin lỗi, hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        );
      }
    }
  }

  /** Đọc lại ticket detail (đã có category/priority/messages sau AI pipeline) để soạn tin nhắn phản hồi. */
  private async buildReplyText(ticketId: string, status: string): Promise<string> {
    try {
      const detail = await this.getTicketDetailUseCase.execute(ticketId);
      const lastAiMessage = [...detail.messages].reverse().find((m) => m.sender === 'AI');

      if (lastAiMessage) {
        return lastAiMessage.content;
      }
      if (status === 'ESCALATED') {
        return `Yêu cầu của bạn (mã ${ticketId.slice(0, 8)}) đã được chuyển cho nhân viên hỗ trợ, vui lòng chờ phản hồi.`;
      }
      if (status === 'WAITING_CUSTOMER') {
        return 'Bạn vui lòng cung cấp thêm thông tin để chúng tôi hỗ trợ chính xác hơn (ví dụ: mã đơn hàng).';
      }
      return `Đã ghi nhận yêu cầu của bạn (mã ${ticketId.slice(0, 8)}).`;
    } catch {
      return `Đã ghi nhận yêu cầu của bạn (mã ${ticketId.slice(0, 8)}).`;
    }
  }
}
