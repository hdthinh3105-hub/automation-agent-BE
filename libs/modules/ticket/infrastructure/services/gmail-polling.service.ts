import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { GmailChannelAdapter } from '../adapters/gmail-channel.adapter';
import { CreateTicketUseCase } from '../../application/use-cases/create-ticket.use-case';
import { GetTicketDetailUseCase } from '../../application/use-cases/ticket-queries.use-case';

/**
 * Danh sách pattern nhận diện email TỰ ĐỘNG/HỆ THỐNG (không phải khách
 * hàng thật gửi tới xin hỗ trợ) — khớp theo địa chỉ người gửi. Giới hạn
 * đã biết (TDD Mục 17): heuristic đơn giản, không phải bộ lọc hoàn hảo.
 */
const AUTOMATED_SENDER_PATTERNS = [
  /no-?reply/i,
  /do-?not-?reply/i,
  /notifications?@/i,
  /mailer-daemon/i,
  /postmaster@/i,
  /@upstash\.com$/i,
  /@render\.com$/i,
  /@vercel\.com$/i,
  /@github\.com$/i,
  /@google\.com$/i,
  /@accounts\.google\.com$/i,
  /@neon\.tech$/i,
  /@groq\.com$/i,
  /@mailgun\.(org|com)$/i,
];

/**
 * Polling service thay thế cơ chế "push" (Mailgun webhook) mà Gmail cá
 * nhân không hỗ trợ miễn phí đơn giản. Mỗi 2 phút, kết nối IMAP vào
 * `INBOX`, tìm thư CHƯA đọc, lọc bỏ email tự động/hệ thống, parse phần
 * còn lại, tạo ticket, rồi đánh dấu đã đọc (`\Seen`) — idempotent
 * (TDD Mục 12).
 */
@Injectable()
export class GmailPollingService {
  private readonly logger = new Logger(GmailPollingService.name);
  private isPolling = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailChannelAdapter: GmailChannelAdapter,
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly getTicketDetailUseCase: GetTicketDetailUseCase,
  ) {}

  @Cron('0 */2 * * * *')
  async pollInbox(): Promise<void> {
    const enabled = this.configService.get<boolean>('email.pollingEnabled', false);
    const gmailUser = this.configService.get<string>('email.gmailUser');
    const gmailAppPassword = this.configService.get<string>('email.gmailAppPassword');

    if (!enabled || !gmailUser || !gmailAppPassword) {
      return;
    }
    if (this.isPolling) {
      this.logger.warn('Poll trước vẫn đang chạy, bỏ qua lượt này để tránh chồng job.');
      return;
    }

    this.isPolling = true;
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: gmailUser, pass: gmailAppPassword },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // { uid: true } bắt buộc — mặc định search() trả sequence
        // number chứ không phải UID thật, gây lệch với fetchOne bên
        // dưới (bug thực tế đã gặp: log "uid=1" dù không hợp lý).
        const uids = await client.search({ seen: false }, { uid: true });
        if (!uids || uids.length === 0) {
          return;
        }
        this.logger.log(`Tìm thấy ${uids.length} email chưa đọc, bắt đầu xử lý.`);

        for (const uid of uids) {
          await this.processMessage(client, uid, gmailUser);
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error(`Gmail IMAP polling lỗi: ${(error as Error).message}`);
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore logout error
      }
      this.isPolling = false;
    }
  }

  private async processMessage(client: ImapFlow, uid: number, selfAddress: string): Promise<void> {
    this.logger.log(`>>> Bắt đầu xử lý email uid=${uid}`);
    try {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message || !message.source) {
        this.logger.warn(`uid=${uid} không fetch được source, bỏ qua.`);
        return;
      }
      const parsed = await simpleParser(message.source);
      this.logger.log(`uid=${uid} from="${parsed.from?.text}" subject="${parsed.subject}"`);

      if (this.shouldSkip(parsed, selfAddress)) {
        this.logger.log(`uid=${uid} bị SKIP (email tự động/hệ thống hoặc gửi cho chính mình).`);
        return;
      }

      const command = this.gmailChannelAdapter.parseIncoming(parsed);
      const ticket = await this.createTicketUseCase.execute(command);
      this.logger.log(`uid=${uid} -> Tạo ticket "${ticket.id}" thành công.`);

      const replyText = await this.buildReplyText(ticket.id, ticket.status);
      await this.gmailChannelAdapter.sendMail(
        command.customerEmail,
        `Re: ${command.subject}`,
        replyText,
      );
    } catch (error) {
      this.logger.error(
        `!!! uid=${uid} XỬ LÝ THẤT BẠI: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        this.logger.log(`uid=${uid} đã đánh dấu \\Seen.`);
      } catch (flagError) {
        this.logger.warn(`uid=${uid} KHÔNG đánh dấu được \\Seen: ${(flagError as Error).message}`);
      }
    }
  }

  /** true nếu email này KHÔNG nên trở thành ticket (tự động/hệ thống/tự gửi cho chính mình). */
  private shouldSkip(parsed: ParsedMail, selfAddress: string): boolean {
    const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase();
    if (!fromAddress) {
      return true; // không xác định được người gửi -> an toàn là bỏ qua
    }
    if (fromAddress === selfAddress.toLowerCase()) {
      return true; // tránh vòng lặp tự trả lời chính mình
    }
    return AUTOMATED_SENDER_PATTERNS.some((pattern) => pattern.test(fromAddress));
  }

  private async buildReplyText(ticketId: string, status: string): Promise<string> {
    try {
      const detail = await this.getTicketDetailUseCase.execute(ticketId);
      const lastAiMessage = [...detail.messages].reverse().find((m) => m.sender === 'AI');
      if (lastAiMessage) {
        return lastAiMessage.content;
      }
      if (status === 'ESCALATED') {
        return `Yêu cầu của bạn (mã ${ticketId.slice(0, 8)}) đã được chuyển cho nhân viên hỗ trợ, chúng tôi sẽ phản hồi sớm nhất.`;
      }
      if (status === 'WAITING_CUSTOMER') {
        return 'Cảm ơn bạn đã liên hệ. Bạn vui lòng cung cấp thêm thông tin (ví dụ mã đơn hàng) để chúng tôi hỗ trợ chính xác hơn.';
      }
      return `Đã ghi nhận yêu cầu của bạn (mã ${ticketId.slice(0, 8)}). Chúng tôi sẽ phản hồi sớm.`;
    } catch {
      return `Đã ghi nhận yêu cầu của bạn (mã ${ticketId.slice(0, 8)}).`;
    }
  }
}
