import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutingDecision } from '../../domain/value-objects/routing-decision.vo';

export interface RoutingPolicyInput {
  confidence: number;
}

/**
 * 🎯 `RoutingPolicyService` (TDD Mục 5.8) — quyết định AUTO_ANSWER hay
 * ESCALATE dựa trên ngưỡng confidence (tách khỏi AI Module vì đây là
 * "business policy" có thể thay đổi theo cấu hình khách hàng, không
 * phải khả năng AI — TDD Mục 5.8 lý do tách module).
 *
 * Đợt Ngày 4 chỉ nhận `confidence` làm input: nhánh Duplicate/Missing
 * Info đã được `ProcessIncomingMessageUseCase` (AI Module) xử lý riêng
 * TRƯỚC khi tới bước Knowledge Retrieval (TDD Mục 8: "chỉ chạy nếu
 * không spam, không duplicate, đủ thông tin"), nên khi hàm này được gọi
 * thì 2 điều kiện đó chắc chắn đã thoả — đơn giản hoá hợp lý cho phạm vi
 * MoSCoW Ngày 4. `RoutingRule` lưu DB động (TDD Mục 5.8) để dành khi
 * Settings Module ra đời ở Phase 8, ghi vào Nhật ký quyết định.
 */
@Injectable()
export class RoutingPolicyService {
  private readonly confidenceThreshold: number;

  constructor(configService: ConfigService) {
    this.confidenceThreshold = configService.get<number>('rag.confidenceEscalationThreshold', 0.6);
  }

  decide(input: RoutingPolicyInput): RoutingDecision {
    if (input.confidence < this.confidenceThreshold) {
      return {
        action: 'ESCALATE',
        reason: `Confidence ${input.confidence.toFixed(2)} below threshold ${this.confidenceThreshold}`,
      };
    }
    return { action: 'AUTO_ANSWER', reason: 'Confidence meets threshold' };
  }
}
