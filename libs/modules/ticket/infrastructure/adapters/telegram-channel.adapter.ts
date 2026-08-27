import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IChannelAdapter, CreateTicketCommand } from '../../application/ports/channel-adapter.port';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name?: string; username?: string };
  };
}

/**
 * Channel Adapter — Should have (TDD Mục 5.3, 14).
 *
 * `sendMessage()` (khác với `sendReply()` của IChannelAdapter — port đó
 * nhận `ticketId` không đủ để gửi Telegram vì cần `chatId`) gọi thẳng
 * Telegram Bot API `sendMessage` để bot trả lời khách ngay trên chat.
 * TelegramWebhookController gọi hàm này sau khi AI pipeline xử lý xong,
 * dùng `chatId` đã có sẵn từ `channelMetadata` của command gốc.
 */
@Injectable()
export class TelegramChannelAdapter implements IChannelAdapter {
  private readonly logger = new Logger(TelegramChannelAdapter.name);
  private readonly botToken: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('telegram.botToken');
  }

  parseIncoming(rawPayload: TelegramUpdate): CreateTicketCommand {
    const message = rawPayload?.message;
    if (!message?.text) {
      throw new Error('Telegram update does not contain a text message');
    }
    const chatId = message.chat.id;
    const fromName =
      message.from?.username ??
      message.from?.first_name ??
      `telegram_user_${message.from?.id ?? chatId}`;
    const syntheticEmail = `telegram-${chatId}@telegram.local`;

    return {
      customerEmail: syntheticEmail,
      customerName: fromName,
      subject: message.text.length > 80 ? `${message.text.slice(0, 77)}...` : message.text,
      content: message.text,
      channel: 'CHAT_APP',
      channelMetadata: { telegramChatId: chatId },
    };
  }

  async sendReply(_ticketId: string, _content: string): Promise<void> {
    // Port cũ nhận ticketId — không đủ để gửi Telegram (cần chatId).
    // Dùng sendMessage() bên dưới thay thế, gọi trực tiếp từ Controller
    // nơi đã có sẵn chatId từ command gốc.
    this.logger.warn(
      'sendReply(ticketId, content) không dùng cho Telegram — dùng sendMessage(chatId, content) thay thế.',
    );
  }

  /**
   * Gửi tin nhắn thật tới Telegram qua Bot API `sendMessage`. Không throw
   * khi thiếu token — chỉ log cảnh báo, để lỗi gửi Telegram không làm
   * fail toàn bộ webhook handler (ticket vẫn đã được tạo thành công).
   */
  async sendMessage(chatId: number | string, text: string): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN chưa cấu hình — bỏ qua gửi tin nhắn phản hồi.');
      return;
    }
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Telegram sendMessage failed (${response.status}): ${body}`);
      }
    } catch (error) {
      this.logger.error(`Telegram sendMessage threw: ${(error as Error).message}`);
    }
  }
}
