import { Inject, Injectable } from '@nestjs/common';
import { ITicketRepository, TICKET_REPOSITORY, Ticket, MessageSender } from '@app/modules/ticket';

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfTicketId: string | null;
}

const LOOKBACK_DAYS = 30;
const SIMILARITY_THRESHOLD = 0.6;

/**
 * 🎯 `DuplicateDetectionService` (TDD Mục 5.7/8, bước 3) — Đợt Ngày 4
 * đơn giản hoá theo đúng MoSCoW đã ghi ở TDD Mục 14.1 ("Duplicate
 * Detection có thể đơn giản hoá bằng so sánh similarity threshold thay
 * vì rule phức tạp"): so khớp bằng Jaccard similarity trên tập từ, THAY
 * VÌ vector similarity qua RAG Module như thiết kế đầy đủ ở Mục 8 —
 * tránh phải thêm bảng lưu embedding riêng cho ticket message trong
 * phạm vi 1 ngày làm việc. So sánh trong cửa sổ 30 ngày, cùng customer.
 */
@Injectable()
export class DuplicateDetectionService {
  constructor(@Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository) {}

  async detect(
    ticketId: string,
    customerId: string,
    content: string,
  ): Promise<DuplicateDetectionResult> {
    const sinceDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const recentTickets = await this.ticketRepository.findRecentByCustomer(
      customerId,
      sinceDate,
      ticketId,
    );
    if (recentTickets.length === 0) {
      return { isDuplicate: false, duplicateOfTicketId: null };
    }

    const currentWords = this.tokenize(content);
    let bestMatch: { ticket: Ticket; similarity: number } | null = null;

    for (const candidate of recentTickets) {
      const messages = await this.ticketRepository.findMessages(candidate.id);
      const firstCustomerMessage = messages.find((m) => m.sender === MessageSender.CUSTOMER);
      if (!firstCustomerMessage) continue;

      const similarity = this.jaccardSimilarity(
        currentWords,
        this.tokenize(firstCustomerMessage.content),
      );
      if (similarity >= SIMILARITY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { ticket: candidate, similarity };
      }
    }

    return bestMatch
      ? { isDuplicate: true, duplicateOfTicketId: bestMatch.ticket.id }
      : { isDuplicate: false, duplicateOfTicketId: null };
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
