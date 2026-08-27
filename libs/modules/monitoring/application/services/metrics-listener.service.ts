import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetricsService } from './metrics.service';

interface TicketStatusChangedPayload {
  toStatus: string;
}

interface AnswerGeneratedPayload {
  confidence: number;
}

/**
 * Cầu nối Domain Event -> Prometheus metric (TDD Mục 13.2). Tách khỏi
 * `MetricsService` (chỉ khai báo/đăng ký metric) để giữ Single
 * Responsibility. Chỉ đăng ký trong `apps/api` — toàn bộ pipeline AI
 * (nơi phát sinh các event này) chạy trong process API.
 */
@Injectable()
export class MetricsListenerService {
  constructor(private readonly metricsService: MetricsService) {}

  @OnEvent('ticket.status_changed')
  handleStatusChanged(event: TicketStatusChangedPayload): void {
    if (event.toStatus === 'ESCALATED') {
      this.metricsService.ticketsEscalatedTotal.inc();
    }
    if (event.toStatus === 'ANSWERED') {
      this.metricsService.ticketsAutoResolvedTotal.inc();
    }
  }

  @OnEvent('rag.answer_generated')
  handleAnswerGenerated(event: AnswerGeneratedPayload): void {
    this.metricsService.aiConfidenceScore.observe(event.confidence);
  }
}
