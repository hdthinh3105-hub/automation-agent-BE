import { Inject, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { FILE_STORAGE, IFileStorage } from '@app/infrastructure';
import { DocumentParseFailedException } from '../../domain/exceptions/rag.exception';

@Injectable()
export class DocumentTextExtractorService {
  private readonly logger = new Logger(DocumentTextExtractorService.name);

  constructor(@Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage) {}

  public async extract(fileRef: string): Promise<string> {
    // fileRef giờ là URL Cloudinary (hoặc path local nếu STORAGE_DRIVER=local)
    const ext = this.extractExtension(fileRef);
    try {
      const buffer = await this.fileStorage.download(fileRef);
      switch (ext) {
        case '.pdf':
          return await this.extractPdf(buffer);
        case '.docx':
          return await this.extractDocx(buffer);
        case '.txt':
        case '.md':
          return buffer.toString('utf-8');
        default:
          throw new Error(`Unsupported file extension for text extraction: "${ext}"`);
      }
    } catch (error) {
      this.logger.error(`Text extraction failed for "${fileRef}": ${(error as Error).message}`);
      throw new DocumentParseFailedException(fileRef, (error as Error).message);
    }
  }

  /** Cloudinary URL public_id giữ nguyên tên file gốc kèm đuôi, nên vẫn lấy extension được bình thường. */
  private extractExtension(fileRef: string): string {
    const withoutQuery = fileRef.split('?')[0];
    return path.extname(withoutQuery).toLowerCase();
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    return result.text as string;
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value as string;
  }
}
