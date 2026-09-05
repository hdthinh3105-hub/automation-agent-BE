import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, EmailJobData } from '@app/infrastructure';
import { GmailChannelAdapter } from '@app/modules/ticket';

/**
 * Email Worker (root fix cho lỗi "Connection timeout" khi gửi SMTP).
 *
 * Trước đây `GmailChannelAdapter.sendMail()` gọi thẳng SMTP ngay trong
 * process API/polling — cùng CPU (Render free tier, throttle mạnh) với
 * pipeline AI (local embedding model, LLM re-ranking) chạy ngay trước
 * đó trong cùng request xử lý email. Việc đó khiến TLS handshake của
 * SMTP không kịp hoàn tất trong `connectionTimeout` dù mạng không hề
 * bị chặn (đã xác minh chéo qua project EventHub — cùng Render free
 * tier, cùng cấu hình `service: 'gmail'`, không có workload AI cạnh
 * tranh CPU, vẫn gửi SMTP bình thường).
 *
 * `EmailProcessor` chạy trong `apps/worker` — process RIÊNG, không bao
 * giờ chạy embedding/LLM — nên việc gửi SMTP không còn bị đói CPU giữa
 * chừng. Input: job `{ to, subject, text }` (enqueue bởi
 * `GmailChannelAdapter.sendMail()`). Retry: 3 lần, backoff
 * 10s/40s/160s (khai báo ở `QueueModule.registerQueue`).
 *
 * `drainDelay`/`stalledInterval`/`guardInterval` (root fix cho "quota
 * tăng liên tục" trên Upstash free 500k lệnh/tháng) là option của Worker
 * (không phải Queue). `drainDelay` giữ ngắn hơn các queue kia (30s) vì
 * email trả lời khách cần nhanh; job mới vẫn được đánh thức ngay qua
 * pub/sub nên drain dài không làm chậm job mới, chỉ giảm tick lúc idle.
 */
@Processor(EMAIL_QUEUE, {
  drainDelay: 30,
  stalledInterval: 300_000,
  guardInterval: 60_000,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly gmailChannelAdapter: GmailChannelAdapter) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, text } = job.data;
    this.logger.log(`[job ${job.id}] Gửi email tới ${to} (attempt ${job.attemptsMade + 1})`);

    try {
      await this.gmailChannelAdapter.sendMailDirect(to, subject, text);
      this.logger.log(`[job ${job.id}] Gửi email tới ${to} thành công.`);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        this.logger.error(
          `[job ${job.id}] Gửi email tới ${to} THẤT BẠI VĨNH VIỄN sau ${job.attemptsMade + 1} lần thử: ${(error as Error).message}`,
        );
      } else {
        this.logger.warn(
          `[job ${job.id}] Gửi email tới ${to} thất bại (lần ${job.attemptsMade + 1}/${maxAttempts}), sẽ retry: ${(error as Error).message}`,
        );
      }
      throw error; // để BullMQ tự retry theo defaultJobOptions
    }
  }
}
