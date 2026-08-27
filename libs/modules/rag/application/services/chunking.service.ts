import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RawChunk {
  content: string;
  section: string | null;
}

const CHARS_PER_TOKEN = 4; // xấp xỉ, cùng heuristic với ConversationTurn.tokensEstimate

/**
 * 🎯 `ChunkingService` (TDD Mục 5.6/7.2 bước [3]) — Recursive
 * Character/Token Splitting: ưu tiên cắt theo ranh giới đoạn văn (`\n\n`)
 * → câu (`. `/`! `/`? `) → từ, tránh cắt giữa câu khi có thể. Giữ heading
 * Markdown (`# `, `## `...) làm `section` metadata cho từng chunk bên
 * dưới nó, tăng chất lượng retrieval + citation (TDD Mục 7.2 bước [4]).
 * `chunkSize`/`chunkOverlap` lấy từ Settings/config, KHÔNG hard-code
 * (TDD Mục 2.7).
 */
@Injectable()
export class ChunkingService {
  private readonly chunkSizeChars: number;
  private readonly chunkOverlapChars: number;

  constructor(private readonly configService: ConfigService) {
    const sizeTokens = this.configService.get<number>('rag.chunkSizeTokens', 500);
    const overlapTokens = this.configService.get<number>('rag.chunkOverlapTokens', 75);
    this.chunkSizeChars = sizeTokens * CHARS_PER_TOKEN;
    this.chunkOverlapChars = overlapTokens * CHARS_PER_TOKEN;
  }

  public chunk(rawText: string): RawChunk[] {
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const sections = this.splitByHeading(normalized);
    const chunks: RawChunk[] = [];
    for (const section of sections) {
      const pieces = this.splitBySize(section.content);
      for (const piece of pieces) {
        if (piece.trim()) chunks.push({ content: piece.trim(), section: section.heading });
      }
    }
    return chunks;
  }

  /** Tách văn bản theo heading Markdown (`#`..`######`) — mỗi block giữ heading làm metadata `section`. */
  private splitByHeading(text: string): Array<{ heading: string | null; content: string }> {
    const headingRegex = /^#{1,6}\s+(.+)$/gm;
    const matches = [...text.matchAll(headingRegex)];
    if (matches.length === 0) {
      return [{ heading: null, content: text }];
    }

    const blocks: Array<{ heading: string | null; content: string }> = [];
    const firstIndex = matches[0].index ?? 0;
    if (firstIndex > 0) {
      blocks.push({ heading: null, content: text.slice(0, firstIndex) });
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      blocks.push({ heading: matches[i][1].trim(), content: text.slice(start, end) });
    }
    return blocks;
  }

  /** Cắt 1 block theo chunkSize, ưu tiên ranh giới đoạn văn → câu → từ, có overlap giữ ngữ cảnh. */
  private splitBySize(text: string): string[] {
    if (text.length <= this.chunkSizeChars) return [text];

    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
    const chunks: string[] = [];
    let current = '';

    const flush = (): void => {
      if (current.trim()) chunks.push(current);
      // Overlap: giữ lại phần đuôi của chunk vừa đóng làm phần đầu chunk kế tiếp.
      current =
        current.length > this.chunkOverlapChars ? current.slice(-this.chunkOverlapChars) : current;
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length > this.chunkSizeChars) {
        // Đoạn văn tự nó đã dài hơn chunkSize -> cắt tiếp theo câu.
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if ((current + ' ' + sentence).length > this.chunkSizeChars) {
            flush();
          }
          current += (current ? ' ' : '') + sentence;
        }
      } else {
        if ((current + '\n\n' + paragraph).length > this.chunkSizeChars) {
          flush();
        }
        current += (current ? '\n\n' : '') + paragraph;
      }
    }
    if (current.trim()) chunks.push(current);
    return chunks;
  }
}
