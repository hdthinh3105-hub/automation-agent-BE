import { Injectable } from '@nestjs/common';
import { TicketCategory } from '../../domain/value-objects/category.vo';

/**
 * 🎯 `MissingInfoDetectionService` (TDD Mục 5.7/8, bước 4) — rule đơn
 * giản theo category: category nào cần thông tin bắt buộc (mã đơn
 * hàng...) mà nội dung không có -> thêm flag tương ứng vào
 * `missingInfoFlags`. Rule hard-code (Settings Module chưa tồn tại —
 * Phase 8), map 1-1 với mã đơn hàng "SV-" trong dữ liệu mẫu KB
 * (`storage/*.md`) để nhất quán khi demo.
 */
@Injectable()
export class MissingInfoDetectionService {
  private static readonly INFO_QUESTION_PATTERN =
    /(chính sách|quy định|điều khoản|hướng dẫn|là gì|ra sao|thế nào|như thế nào|bao lâu|bao nhiêu|hoạt động như)/i;

  detect(category: TicketCategory, content: string): string[] {
    const flags: string[] = [];
    const orderCodePattern = /SV-\d{8}/i;
    const isInfoQuestion = MissingInfoDetectionService.INFO_QUESTION_PATTERN.test(content);

    if (category === 'Yêu cầu thanh toán' && !orderCodePattern.test(content) && !isInfoQuestion) {
      flags.push('MISSING_ORDER_CODE');
    }
    if (
      category === 'Yêu cầu kỹ thuật' &&
      !orderCodePattern.test(content) &&
      content.trim().length < 20
    ) {
      flags.push('MISSING_ISSUE_DETAIL');
    }
    if (category === 'Khiếu nại' && content.trim().length < 15) {
      flags.push('MISSING_COMPLAINT_DETAIL');
    }

    return flags;
  }
}
