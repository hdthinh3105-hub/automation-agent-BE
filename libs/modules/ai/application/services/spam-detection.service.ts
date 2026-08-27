import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SpamDetectionResult {
  isSpam: boolean;
  score: number;
}

const SPAM_KEYWORDS = [
  'trúng thưởng',
  'click vào link',
  'khuyến mãi khủng',
  'kiếm tiền tại nhà',
  'vay tiền nhanh',
  'đầu tư sinh lời',
  'casino',
  'viagra',
  'nổ hũ',
];

/**
 * 🎯 `SpamDetectionService` (TDD Mục 5.7/8, bước 2) — heuristic-only cho
 * Đợt Ngày 4 (không gọi LLM, đúng tinh thần "tránh gọi LLM cho mọi case
 * rõ ràng, tiết kiệm quota free" — TDD bảng Mục 8). Kết hợp:
 * - Blacklist từ khoá quảng cáo/lừa đảo phổ biến
 * - Mật độ link bất thường (>=2 URL trong nội dung)
 * - Nội dung toàn chữ hoa (SHOUTING) trên đoạn đủ dài
 * - Nội dung quá ngắn/vô nghĩa (dưới 3 ký tự sau khi trim)
 * Ngưỡng lấy từ `SPAM_SCORE_THRESHOLD` (config-driven, TDD Mục 2.7).
 */
@Injectable()
export class SpamDetectionService {
  private readonly threshold: number;

  constructor(configService: ConfigService) {
    this.threshold = configService.get<number>('rag.spamScoreThreshold', 0.8);
  }

  detect(content: string): SpamDetectionResult {
    const trimmed = content.trim();
    if (trimmed.length < 3) {
      return { isSpam: true, score: 1 };
    }

    let score = 0;
    const lower = trimmed.toLowerCase();

    const keywordHits = SPAM_KEYWORDS.filter((kw) => lower.includes(kw)).length;
    score += Math.min(0.6, keywordHits * 0.3);

    const urlCount = (trimmed.match(/https?:\/\/\S+/g) ?? []).length;
    if (urlCount >= 2) score += 0.3;

    const letters = trimmed.replace(/[^a-zA-ZÀ-ỹ]/g, '');
    if (letters.length > 20) {
      const upperRatio = (letters.match(/[A-ZÀ-Ỵ]/g) ?? []).length / letters.length;
      if (upperRatio > 0.8) score += 0.2;
    }

    score = Math.min(1, score);
    return { isSpam: score >= this.threshold, score };
  }
}
