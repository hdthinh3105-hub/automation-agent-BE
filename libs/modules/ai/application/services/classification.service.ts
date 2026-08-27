import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER, ILlmProvider } from '@app/infrastructure';
import { TicketCategory, isKnownCategory } from '../../domain/value-objects/category.vo';
import { PromptLogService } from './prompt-log.service';

export interface ClassificationResult {
  category: TicketCategory;
  confidence: number;
}

const SYSTEM_CLASSIFICATION_PROMPT = `Bạn là bộ phân loại yêu cầu hỗ trợ khách hàng. Tin nhắn của khách có thể là câu HỎI thông tin hoặc YÊU CẦU XỬ LÝ một vấn đề. Chọn ĐÚNG 1 nhóm duy nhất phù hợp nhất, chỉ trả ra chính xác tên nhóm, không thêm giải thích, không thêm dấu câu.

Quy tắc bắt buộc: KHÔNG mặc định chọn "Hỏi đáp thông tin". Chỉ chọn "Hỏi đáp thông tin" khi khách thuần túy HỎI thông tin/chính sách chung. Nếu khách YÊU CẦU xử lý một việc cụ thể (hoàn tiền, thanh toán, lỗi kỹ thuật, khiếu nại, tình huống khẩn cấp) thì phải chọn nhóm tương ứng.

Các nhóm:
- Hỏi đáp thông tin: khách chỉ hỏi chính sách chung, hướng dẫn, giá cả, freeship, thời gian giao hàng, quy định...
- Khiếu nại: khách phàn nàn, bất mãn, không hài lòng về sản phẩm/dịch vụ/trải nghiệm.
- Yêu cầu kỹ thuật: lỗi app/website/hệ thống, không đăng nhập được, crash, treo, không hoạt động.
- Yêu cầu thanh toán: hoàn tiền, thanh toán, nạp tiền, chuyển khoản, giao dịch, thẻ, ví điện tử.
- Yêu cầu khẩn cấp: khẩn cấp, gấp, mất tiền, gian lận, hệ thống sập.`;

const FALLBACK_CATEGORY: TicketCategory = 'Hỏi đáp thông tin';

/**
 * 🎯 `ClassificationService` (TDD Mục 5.7/8, bước 1) — gọi LLM để phân
 * loại nội dung message vào 1 trong `TICKET_CATEGORIES`. Nếu LLM lỗi
 * hoặc trả về giá trị không hợp lệ, fallback về heuristic từ khoá đơn
 * giản — KHÔNG để lỗi LLM chặn toàn bộ pipeline (TDD Mục 15: rate-limit
 * LLM free tier là rủi ro đã biết).
 */
@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: ILlmProvider,
    private readonly promptLogService: PromptLogService,
  ) {}

  async classify(content: string, ticketId: string): Promise<ClassificationResult> {
    try {
      const startedAt = Date.now();
      const result = await this.llmProvider.complete(
        [
          { role: 'system', content: SYSTEM_CLASSIFICATION_PROMPT },
          { role: 'user', content },
        ],
        { temperature: 0, maxTokens: 30 },
      );

      const category = result.content.trim();
      void this.promptLogService.log({
        ticketId,
        useCase: 'classification',
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: Date.now() - startedAt,
        responseRaw: result.content,
      });

      if (isKnownCategory(category)) {
        return this.refineWithHeuristic(category, content);
      }
      this.logger.warn(`LLM returned unknown category "${category}", falling back to heuristic`);
      return { category: this.heuristicClassify(content), confidence: 0.4 };
    } catch (error) {
      this.logger.warn(
        `Classification LLM call failed, falling back to heuristic: ${(error as Error).message}`,
      );
      return { category: this.heuristicClassify(content), confidence: 0.3 };
    }
  }

  private refineWithHeuristic(llmCategory: TicketCategory, content: string): ClassificationResult {
    const heuristic = this.heuristicClassify(content);
    if (llmCategory !== FALLBACK_CATEGORY) {
      // LLM chọn nhóm cụ thể — giữ nguyên, trừ khi heuristic khớp biến
      // thể giá trị cần xử lý (VD "thanh toán" bao phủ "nạp tiền/chuyển khoản").
      if (heuristic !== FALLBACK_CATEGORY && heuristic !== llmCategory) {
        return { category: heuristic, confidence: 0.65 };
      }
      return { category: llmCategory, confidence: 0.9 };
    }
    // LLM mặc định "Hỏi đáp thông tin" nhưng heuristic khớp category cụ thể
    // (khách YÊU CẦU xử lý) → ưu tiên heuristic để chuyển hướng xử lý đúng.
    if (heuristic !== FALLBACK_CATEGORY) {
      this.logger.debug(
        `Classification refined: LLM=${llmCategory}, heuristic=${heuristic}, content=${content.slice(0, 60)}`,
      );
      return { category: heuristic, confidence: 0.6 };
    }
    return { category: llmCategory, confidence: 0.9 };
  }

  private heuristicClassify(content: string): TicketCategory {
    const lower = content.toLowerCase();
    if (/(khẩn cấp|gấp|mất tiền|gian lận|sập|không thể truy cập)/.test(lower)) {
      return 'Yêu cầu khẩn cấp';
    }
    if (/(chính sách|quy định|điều khoản)/.test(lower)) {
      return 'Hỏi đáp thông tin';
    }
    if (
      /(khiếu nại|phàn nàn|bực bội|tức giận|quá tệ|chán nản|không hài lòng|thất vọng|hàng hỏng|giao sai|sai kích cỡ|sai màu|sản phẩm cũ|nhận sai)/.test(
        lower,
      )
    ) {
      return 'Khiếu nại';
    }
    if (
      /(thanh toán|hoàn tiền|tiền hoàn|hoàn lại|thẻ|ví điện tử|nạp tiền|chuyển khoản|cộng tiền|trừ tiền|giao dịch|pay-)/.test(
        lower,
      )
    ) {
      return 'Yêu cầu thanh toán';
    }
    if (/(lỗi|bug|không đăng nhập|không hoạt động|crash|treo)/.test(lower)) {
      return 'Yêu cầu kỹ thuật';
    }
    return FALLBACK_CATEGORY;
  }
}
