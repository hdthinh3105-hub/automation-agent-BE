import 'reflect-metadata';
import * as http from 'http';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Worker process entrypoint. Dùng chung codebase `libs/` với API process
 * (TDD §2.4/§2.8) — chạy Document Parser + Embedding BullMQ Processor.
 *
 * GHI CHÚ TRIỂN KHAI (Render free tier): Render free tier chỉ hỗ trợ
 * "Web Service" (bắt buộc bind 1 HTTP port) — không có "Background Worker"
 * miễn phí. Vì vậy worker này mở kèm 1 HTTP server tối giản chỉ để trả
 * lời health-check của Render (`/`), KHÔNG phục vụ nghiệp vụ gì — toàn bộ
 * xử lý thật vẫn là 2 BullMQ Processor đăng ký trong `WorkerModule`. Đây
 * là giới hạn triển khai do ràng buộc free-tier, không phải thiết kế hệ
 * thống (ghi vào Nhật ký quyết định, TDD Mục 17).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // eslint-disable-next-line no-console
  console.log(
    '🛠️  Worker process started — Document Parser + Embedding queues are being processed.',
  );

  const port = Number(process.env.WORKER_PORT ?? process.env.PORT ?? 3001);
  const healthServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', role: 'worker' }));
  });
  healthServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `🩺 Worker health-check server listening on port ${port} (Render free-tier requirement)`,
    );
  });

  process.on('SIGTERM', async () => {
    healthServer.close();
    await app.close();
    process.exit(0);
  });
}

bootstrap();
