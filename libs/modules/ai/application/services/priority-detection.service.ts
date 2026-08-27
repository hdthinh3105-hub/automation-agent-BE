import { Injectable } from '@nestjs/common';
import { PriorityLevel } from '@app/modules/ticket';
import { TicketCategory } from '../../domain/value-objects/category.vo';

const URGENT_KEYWORDS =
  /(khẩn cấp|gấp lắm|mất tiền|gian lận|sập hệ thống|không thể truy cập|24\/7)/i;
const HIGH_KEYWORDS = /(không đăng nhập được|lỗi thanh toán|không nhận được hàng|bị trừ tiền)/i;

/**
 * 🎯 `PriorityDetectionService` (TDD Mục 5.7/8, bước 5) — rule tường
 * minh kết hợp category + từ khoá khẩn cấp, KHÔNG gọi LLM (giữ đơn
 * giản cho Đợt Ngày 4; hướng mở rộng LLM cho case mơ hồ ghi ở Nhật ký
 * quyết định TDD Mục 17 nếu cần độ chính xác cao hơn).
 */
@Injectable()
export class PriorityDetectionService {
  detect(category: TicketCategory, content: string): PriorityLevel {
    if (category === 'Yêu cầu khẩn cấp' || URGENT_KEYWORDS.test(content)) {
      return PriorityLevel.URGENT;
    }
    if (HIGH_KEYWORDS.test(content)) {
      return PriorityLevel.HIGH;
    }
    if (category === 'Yêu cầu thanh toán' || category === 'Yêu cầu kỹ thuật') {
      return PriorityLevel.MEDIUM;
    }
    if (category === 'Khiếu nại') {
      return PriorityLevel.MEDIUM;
    }
    return PriorityLevel.LOW;
  }
}
