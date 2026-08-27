import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdateProcessor } from './telegram-update.processor';

interface TelegramUpdate {
  update_id?: number;
  message?: unknown;
}

const GET_UPDATES_TIMEOUT_SECONDS = 50;
const RETRY_DELAY_MS = 5000;

/**
 * Long-polling Telegram Bot API (`getUpdates`) — nhận tin nhắn từ khách
 * mà KHÔNG cần URL public/webhook (dành cho chạy local / Docker sau NAT,
 * nơi không có domain như Render). Telegram sẽ giữ request tối đa
 * `timeout=50s` và trả về ngay khi có update mới cho từng offset.
 *
 * Lưu ý:
 * - Telegram chỉ cho phép 1 nguồn update duy nhất — lúc chạy polling,
 *   khởi động sẽ gọi `deleteWebhook` để dọn webhook đặt trước đó.
 * - Chỉ nên có 1 instance polling (tránh duplicate ticket) — với Docker
 *   local chỉ có 1 container API, đủ an toàn.
 * - Bật/tắt qua `TELEGRAM_POLLING_ENABLED` (mặc định tắt, giữ webhook
 *   khi deploy lên Render có URL public).
 */
@Injectable()
export class TelegramPollingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramPollingService.name);
  private readonly botToken: string | undefined;
  private running = false;
  private started = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly updateProcessor: TelegramUpdateProcessor,
  ) {
    this.botToken = this.configService.get<string>('telegram.botToken');
  }

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.configService.get<boolean>('telegram.pollingEnabled', false);
    if (!enabled || !this.botToken) {
      if (enabled) {
        this.logger.warn(
          'TELEGRAM_POLLING_ENABLED=true nhưng thiếu TELEGRAM_BOT_TOKEN — bỏ qua polling.',
        );
      }
      return;
    }
    if (this.started) return;
    this.started = true;
    this.logger.log('Khởi động Telegram long-polling (getUpdates) — không cần URL public.');
    void this.run();
  }

  onApplicationShutdown(): void {
    this.running = false;
  }

  private async run(): Promise<void> {
    this.running = true;
    let offset = 0;
    await this.deleteWebhook();

    while (this.running) {
      try {
        const updates = await this.fetchUpdates(offset);
        for (const update of updates) {
          if (!update || typeof update.update_id !== 'number') continue;
          offset = Math.max(offset, update.update_id + 1);
          try {
            await this.updateProcessor.handleUpdate(update);
          } catch (error) {
            this.logger.warn(
              `Telegram update ${update.update_id} xử lý thất bại: ${(error as Error).message}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Telegram getUpdates lỗi (${(error as Error).message}) — chờ ${RETRY_DELAY_MS / 1000}s rồi thử lại.`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    this.logger.log('Telegram polling stopped.');
  }

  private async deleteWebhook(): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`);
      const json = (await response.json()) as { ok?: boolean; description?: string };
      if (!json.ok) {
        this.logger.warn(`deleteWebhook thất bại: ${json.description ?? 'unknown'}`);
      }
    } catch (error) {
      this.logger.warn(`deleteWebhook lỗi: ${(error as Error).message}`);
    }
  }

  private async fetchUpdates(offset: number): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({
      timeout: String(GET_UPDATES_TIMEOUT_SECONDS),
      allowed_updates: '["message"]',
    });
    if (offset > 0) params.set('offset', String(offset));

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getUpdates?${params}`,
    );
    if (!response.ok) {
      throw new Error(`Telegram API HTTP ${response.status}`);
    }
    const json = (await response.json()) as {
      ok?: boolean;
      result?: TelegramUpdate[];
      description?: string;
    };
    if (!json.ok) {
      throw new Error(`Telegram API error: ${json.description ?? 'unknown'}`);
    }
    return json.result ?? [];
  }
}
