import { Injectable, Logger } from '@nestjs/common';
import { IChannelAdapter, CreateTicketCommand } from '../../application/ports/channel-adapter.port';

/**
 * Payload chuẩn hoá từ Mailgun Inbound Route webhook (form-data POST).
 * Mailgun gửi các field chính: `sender`, `subject`, `body-plain`,
 * `stripped-text` (nội dung đã loại bỏ chữ ký/quote trả lời cũ — ưu
 * tiên dùng field này nếu có, tránh nội dung ticket lẫn cả lịch sử email
 * dài dòng). Docs: https://documentation.mailgun.com/en/latest/user_manual.html#receiving-forwarding-and-storing-messages
 */
interface MailgunInboundPayload {
  sender?: string;
  from?: string;
  subject?: string;
  'body-plain'?: string;
  'stripped-text'?: string;
  'message-headers'?: string;
}

/**
 * Channel Adapter — Could have (TDD Mục 5.3, 14.1). Nhận webhook từ
 * Mailgun Inbound Route khi có email gửi tới địa chỉ hỗ trợ (vd
 * support@yourdomain.mailgun.org ở free sandbox domain). Mỗi email tạo
 * 1 ticket mới — giống giới hạn đã biết của TelegramChannelAdapter,
 * chưa thread nhiều email cùng chủ đề vào 1 ticket (hướng cải tiến nếu
 * có thêm thời gian, dùng header `In-Reply-To`/`References` để nối
 * chuỗi email vào đúng ticket cũ).
 */
@Injectable()
export class EmailChannelAdapter implements IChannelAdapter {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  parseIncoming(rawPayload: MailgunInboundPayload): CreateTicketCommand {
    const fromRaw = rawPayload.sender ?? rawPayload.from;
    if (!fromRaw) {
      throw new Error('Email webhook payload does not contain a sender address');
    }
    const email = this.extractEmailAddress(fromRaw);
    const content = (rawPayload['stripped-text'] ?? rawPayload['body-plain'] ?? '').trim();
    if (!content) {
      throw new Error('Email webhook payload has no readable body content');
    }
    const subject = rawPayload.subject?.trim() || 'Yêu cầu hỗ trợ qua Email';

    return {
      customerEmail: email,
      customerName: this.extractDisplayName(fromRaw),
      subject: subject.length > 150 ? `${subject.slice(0, 147)}...` : subject,
      content,
      channel: 'EMAIL',
      channelMetadata: { rawFrom: fromRaw },
    };
  }

  async sendReply(ticketId: string, content: string): Promise<void> {
    // Chưa implement gửi email trả lời thật (cần Mailgun Sending API +
    // domain đã verify) — Đợt Ngày 4 khách xem câu trả lời qua Dashboard.
    // Hướng mở rộng: gọi Mailgun Messages API để gửi reply đúng thread
    // (dùng In-Reply-To header từ message-headers gốc).
    this.logger.warn(
      `sendReply() chưa được implement cho EmailChannelAdapter (ticketId=${ticketId}, content length=${content.length})`,
    );
  }

  /** "Nguyễn Văn A <a@example.com>" -> "a@example.com" | "a@example.com" -> "a@example.com" */
  private extractEmailAddress(raw: string): string {
    const match = raw.match(/<([^>]+)>/);
    return (match ? match[1] : raw).trim().toLowerCase();
  }

  /** "Nguyễn Văn A <a@example.com>" -> "Nguyễn Văn A" | không có tên -> undefined */
  private extractDisplayName(raw: string): string | undefined {
    const match = raw.match(/^([^<]+)</);
    const name = match?.[1]?.trim();
    return name && name.length > 0 ? name : undefined;
  }
}
