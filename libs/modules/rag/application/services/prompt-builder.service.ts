import { Injectable } from '@nestjs/common';
import { LlmMessage } from '@app/infrastructure';
import { HybridSearchResult } from './hybrid-search.service';

export interface CitationEntry {
  index: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  section: string | null;
}

export interface BuiltPrompt {
  messages: LlmMessage[];
  citations: CitationEntry[];
}

const SYSTEM_INSTRUCTION = `Bạn là trợ lý hỗ trợ khách hàng, CHỈ được trả lời dựa trên các đoạn tài liệu được cung cấp bên dưới (đánh số [1], [2], ...).
Quy tắc BẮT BUỘC:
1. Nếu tài liệu có thông tin trả lời được câu hỏi, trả lời ngắn gọn, chính xác, kèm trích dẫn nguồn ngay sau mỗi ý bằng ký hiệu [n] tương ứng.
2. Nếu tài liệu KHÔNG có đủ thông tin để trả lời, PHẢI trả lời đúng câu: "Xin lỗi, tôi không tìm thấy đủ thông tin trong tài liệu hiện có để trả lời chính xác câu hỏi này." — TUYỆT ĐỐI KHÔNG được tự bịa thông tin ngoài tài liệu.
3. Không lặp lại toàn bộ đoạn tài liệu, chỉ tóm tắt ý liên quan.
4. Kết thúc câu trả lời bằng 1 dòng riêng đúng định dạng: "CONFIDENCE: x.xx" (x.xx là số thập phân 0.00-1.00, tự đánh giá mức độ chắc chắn câu trả lời của bạn dựa HOÀN TOÀN vào tài liệu được cung cấp — không phải kiến thức ngoài).`;

/**
 * 🎯 `PromptBuilderService` (TDD Mục 5.6/7.2 bước [10]) — template chuẩn:
 * System instruction (vai trò, phạm vi, yêu cầu trích dẫn) + Context
 * (từng chunk kèm số thứ tự nguồn) + Lịch sử hội thoại rút gọn (tham số
 * `conversationHistory`, để trống ở Đợt 2 vì việc gọi từ Conversation
 * Module thuộc AI Workflow orchestrator — Phase 6) + Câu hỏi hiện tại.
 * Quản lý token budget: ưu tiên cắt bớt history trước context nếu vượt
 * giới hạn (áp dụng khi `conversationHistory` được truyền vào ở Phase 6).
 */
@Injectable()
export class PromptBuilderService {
  build(
    query: string,
    chunks: HybridSearchResult[],
    conversationHistory: LlmMessage[] = [],
  ): BuiltPrompt {
    const citations: CitationEntry[] = chunks.map((result, i) => ({
      index: i + 1,
      chunkId: result.chunk.id,
      documentId: result.chunk.documentId,
      documentTitle: result.documentTitle,
      section: result.chunk.section,
    }));

    const contextBlock = chunks
      .map((result, i) => {
        const sectionLabel = result.chunk.section ? ` — ${result.chunk.section}` : '';
        return `[${i + 1}] (Nguồn: "${result.documentTitle}"${sectionLabel})\n${result.chunk.content}`;
      })
      .join('\n\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...conversationHistory,
      {
        role: 'user',
        content: `Tài liệu tham khảo:\n${contextBlock}\n\nCâu hỏi của khách hàng: ${query}`,
      },
    ];

    return { messages, citations };
  }
}
