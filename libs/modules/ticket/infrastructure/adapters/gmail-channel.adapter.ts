import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ParsedMail } from 'mailparser';
import { convert as htmlToText } from 'html-to-text';
import { IChannelAdapter, CreateTicketCommand } from '../../application/ports/channel-adapter.port';
import { JOBS_QUEUE, JOB_SEND_EMAIL, EmailJobData } from '@app/infrastructure';

/**
 * Channel Adapter — Could have (TDD Mục 5.3, 14.1). Thay thế Mailgun:
 * dùng thẳng Gmail cá nhân qua IMAP (nhận) và SMTP (gửi trả lời).
 *
 * ROOT FIX (sau khi loại trừ giả thuyết "Render free tier chặn SMTP" —
 * dự án EventHub cùng hạ tầng Render free tier gửi SMTP bình thường):
 * nguyên nhân thật là process API/polling này chạy CHUNG CPU (Render
 * free tier, throttle mạnh) với pipeline AI (local embedding model,
 * LLM re-ranking) ngay trong cùng request xử lý email. TLS handshake
 * của SMTP cần CPU cho crypto — nếu bị đói CPU ngay sau khi vừa chạy
 * embedding, handshake không kịp hoàn tất trong `connectionTimeout` dù
 * mạng không hề bị chặn.
 *
 * `sendMail()` giờ CHỈ enqueue job `email.send` vào queue `jobs`
 * (BullMQ/Redis) — trả về gần như ngay lập tức, không còn chạm SMTP
 * trong process API/polling. Việc gửi thật do `JobsProcessor`
 * (apps/worker) đảm nhiệm — 1 process riêng, không tranh CPU với AI.
 */
@Injectable()
export class GmailChannelAdapter implements IChannelAdapter {
  private readonly logger = new Logger(GmailChannelAdapter.name);
  private readonly gmailUser: string | undefined;
  private readonly gmailAppPassword: string | undefined;
  private readonly gmailClientId: string | undefined;
  private readonly gmailClientSecret: string | undefined;
  private readonly gmailRefreshToken: string | undefined;
  private transporter: nodemailer.Transporter | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(JOBS_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {
    this.gmailUser = this.configService.get<string>('email.gmailUser');
    this.gmailAppPassword = this.configService.get<string>('email.gmailAppPassword');
    this.gmailClientId = this.configService.get<string>('email.gmailClientId');
    this.gmailClientSecret = this.configService.get<string>('email.gmailClientSecret');
    this.gmailRefreshToken = this.configService.get<string>('email.gmailRefreshToken');
  }

  /** Đã đủ bộ OAuth → ưu tiên gửi qua Gmail REST API (HTTPS 443, không bị Render free chặn). */
  private get useGmailApi(): boolean {
    return Boolean(this.gmailClientId && this.gmailClientSecret && this.gmailRefreshToken);
  }

  parseIncoming(rawPayload: ParsedMail): CreateTicketCommand {
    const fromAddress = rawPayload.from?.value?.[0]?.address;
    if (!fromAddress) {
      throw new Error('Gmail message does not contain a readable "from" address');
    }

    // Gmail Web/App thường soạn mail dạng HTML, không có `text` thuần
    // — mailparser trả `rawPayload.text` là undefined trong trường hợp
    // đó dù `rawPayload.html` có nội dung. Fallback: nếu không có text
    // thuần, tự convert từ HTML sang text (bug đã gặp trong thực tế:
    // email thật gửi tới không tạo được ticket vì bị throw ở đây rồi
    // catch âm thầm, log không rõ ràng).
    let content = (rawPayload.text ?? '').trim();
    if (!content && rawPayload.html) {
      content = htmlToText(rawPayload.html, { wordwrap: false }).trim();
    }
    if (!content) {
      throw new Error('Gmail message has no readable text or html body');
    }

    const fromName = rawPayload.from?.value?.[0]?.name;
    const subject = (rawPayload.subject ?? 'Yêu cầu hỗ trợ qua Email').trim();

    return {
      customerEmail: fromAddress.toLowerCase(),
      customerName: fromName && fromName.trim().length > 0 ? fromName.trim() : undefined,
      subject: subject.length > 150 ? `${subject.slice(0, 147)}...` : subject,
      content,
      channel: 'EMAIL',
      channelMetadata: { messageId: rawPayload.messageId },
    };
  }

  async sendReply(ticketId: string, content: string): Promise<void> {
    this.logger.warn(
      `sendReply(ticketId, content) không dùng cho Gmail — dùng sendMail(to, subject, text) thay thế (ticketId=${ticketId}, content length=${content.length})`,
    );
  }

  /**
   * Gọi từ GmailPollingService/luồng xử lý request — CHỈ enqueue, không
   * gửi SMTP trực tiếp ở đây nữa (xem ghi chú ROOT FIX ở đầu file).
   */
  async sendMail(to: string, subject: string, text: string): Promise<void> {
    if (!this.gmailUser || (!this.gmailAppPassword && !this.useGmailApi)) {
      this.logger.warn(
        'GMAIL_USER + (GMAIL_APP_PASSWORD hoặc GMAIL_REFRESH_TOKEN) chưa cấu hình — bỏ qua gửi email phản hồi.',
      );
      return;
    }
    try {
      await this.emailQueue.add(
        JOB_SEND_EMAIL,
        { to, subject, text },
        // Giữ nguyên semantics cũ của queue email: retry 3 lần, backoff
        // exponential 10s (trước đây khai báo ở QueueModule). jobId để
        // BullMQ tự loại trùng nếu vô tình enqueue lại đúng (to, subject)
        // trong cùng giây — không bắt buộc nhưng an toàn.
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { count: 200 },
          removeOnFail: false,
          jobId: `email:${Date.now()}:${to}`,
        },
      );
      this.logger.log(`>>> Đã enqueue email tới ${to} (subject="${subject}") — worker sẽ gửi.`);
    } catch (error) {
      // Lỗi enqueue (Redis down...) khác hẳn lỗi SMTP — vẫn log rõ
      // nhưng không throw để không làm hỏng luồng tạo ticket/mark \Seen.
      this.logger.error(
        `Enqueue email thất bại: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Gửi mail THẬT — chỉ được gọi từ `JobsProcessor` (apps/worker), một
   * process riêng biệt. KHÔNG catch lỗi ở đây: để lỗi throw ra ngoài cho
   * BullMQ tự retry (3 lần, backoff exponential 10s).
   *
   * Mặc định gửi qua Gmail REST API (OAuth2, HTTPS port 443) — không bị
   * Render free tier chặn như SMTP 465/587 (chính sách từ 26/09/2025).
   * Nếu không cấu hình OAuth thì fallback về SMTP cũ (vẫn chạy local).
   */
  async sendMailDirect(to: string, subject: string, text: string): Promise<void> {
    if (!this.gmailUser || (!this.gmailAppPassword && !this.useGmailApi)) {
      this.logger.warn(
        'GMAIL_USER + (GMAIL_APP_PASSWORD hoặc GMAIL_REFRESH_TOKEN) chưa cấu hình — bỏ qua gửi email phản hồi.',
      );
      return;
    }
    this.logger.log(`>>> Bắt đầu gửi email tới ${to} (subject="${subject}")`);
    if (this.useGmailApi) {
      await this.sendViaGmailApi(to, subject, text);
    } else {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"Hỗ trợ khách hàng" <${this.gmailUser}>`,
        to,
        subject,
        text,
      });
    }
    this.logger.log(`Đã gửi email trả lời tới ${to}`);
  }

  /** Lấy access token (cache ~1h), tự refresh nếu hết hạn hoặc chưa có. */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.gmailClientId!,
        client_secret: this.gmailClientSecret!,
        refresh_token: this.gmailRefreshToken!,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Không refresh được Gmail OAuth token (HTTP ${response.status}): ${body}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in?: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + ((data.expires_in ?? 3600) - 60) * 1000;
    return this.accessToken;
  }

  /** Gửi qua Gmail REST API: POST /gmail/v1/users/me/messages/send. */
  private async sendViaGmailApi(to: string, subject: string, text: string): Promise<void> {
    const token = await this.getAccessToken();
    const raw = this.buildRawMessage(to, subject, text);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: Buffer.from(raw, 'utf-8').toString('base64url') }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail API send thất bại (HTTP ${response.status}): ${body}`);
    }
    const result = (await response.json()) as { id?: string };
    this.logger.log(`Gmail API đã chấp nhận email, messageId=${result.id}`);
  }

  /** Dựng email dạng RFC 2822 (MIME) để gửi qua Gmail API. */
  private buildRawMessage(to: string, subject: string, text: string): string {
    const lines = [
      `From: "${this.encodeHeader('Hỗ trợ khách hàng')}" <${this.gmailUser}>`,
      `To: ${to}`,
      `Subject: ${this.encodeHeader(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      `Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${this.gmailUser!.split('@')[1]}>`,
      '',
      Buffer.from(text, 'utf-8').toString('base64'),
    ];
    return lines.join('\r\n');
  }

  /** Mã hóa header chứa ký tự không-ASCII (VD tiếng Việt) theo RFC 2047. */
  private encodeHeader(value: string): string {
    return /[\u0080-\uFFFF]/.test(value)
      ? `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`
      : value;
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      // Dùng host/port tường minh thay vì shorthand `service: 'gmail'`
      // — trên một số PaaS (Render free tier), cách resolve DNS/host
      // ngầm của `service: 'gmail'` đôi khi kết nối chậm/treo dẫn tới
      // "Connection timeout" dù cùng code chạy ổn định ở máy local.
      // Cổng 465 (SMTPS, secure:true) ổn định hơn cổng 587 (STARTTLS)
      // trên môi trường container có outbound network hạn chế.
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: this.gmailUser, pass: this.gmailAppPassword },
        connectionTimeout: 20_000,
        greetingTimeout: 20_000,
        socketTimeout: 20_000,
      });
    }
    return this.transporter;
  }
}
