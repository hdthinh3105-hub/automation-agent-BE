/**
 * Danh sách category mặc định (TDD Mục 8, Ngày 4) — khớp trực tiếp với
 * 5 nhóm nêu trong đề bài gốc (hỏi đáp, khiếu nại, kỹ thuật, thanh
 * toán, khẩn cấp). Config-driven qua Settings Module là hướng đúng lâu
 * dài (TDD Mục 5.16), nhưng Settings Module chưa tồn tại (Phase 8) —
 * hard-code tạm thời ở đây, ghi rõ giới hạn này vào Nhật ký quyết định
 * (TDD Mục 17).
 */
export const TICKET_CATEGORIES = [
  'Hỏi đáp thông tin',
  'Khiếu nại',
  'Yêu cầu kỹ thuật',
  'Yêu cầu thanh toán',
  'Yêu cầu khẩn cấp',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export function isKnownCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}
