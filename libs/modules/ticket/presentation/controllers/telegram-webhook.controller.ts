import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@app/shared/decorators/public.decorator';
import { TelegramUpdateProcessor } from '../../infrastructure/services/telegram-update.processor';

/**
 * Webhook nhận update từ Telegram Bot API (TDD Mục 5.3 — ChatAppChannelAdapter).
 * Chỉ hoạt động khi có URL public (đặt qua `setWebhook`). Logic xử lý
 * update dùng chung `TelegramUpdateProcessor` với `TelegramPollingService`
 * (long-poll getUpdates — dành cho môi trường không có URL public).
 */
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(private readonly updateProcessor: TelegramUpdateProcessor) {}

  @Public()
  @Post()
  async handleUpdate(@Body() update: unknown): Promise<{ ok: true }> {
    await this.updateProcessor.handleUpdate(update);
    return { ok: true };
  }
}
