import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { IFileStorage, UploadedFile } from './storage.port';

/**
 * Adapter Cloudinary — dùng `resource_type: 'raw'` vì tài liệu KB
 * (PDF/DOCX/TXT/MD) không phải ảnh. `public_id` cố định = tên file gốc
 * (đã prefix timestamp ở UploadDocumentUseCase) để tránh Cloudinary tự
 * sinh ID ngẫu nhiên, dễ tra cứu/xoá thủ công khi cần.
 *
 * ⚠️ LƯU Ý QUAN TRỌNG (Cloudinary free tier, từ 2025): Cloudinary mặc
 * định CHẶN truy cập công khai file `raw`/PDF qua URL trực tiếp (chống
 * lạm dụng) trừ khi bạn bật "Allow delivery of PDF and ZIP files" trong
 * Dashboard → Settings → Security. Nếu không bật, `download()` (fetch
 * qua URL) sẽ trả 401. Cách bật:
 * Dashboard → Settings (icon bánh răng) → Security →
 * "Restricted media types" → bỏ tick "PDF and ZIP files".
 */
@Injectable()
export class CloudinaryFileStorage implements IFileStorage {
  private readonly logger = new Logger(CloudinaryFileStorage.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  async upload(buffer: Buffer, filename: string, _mimetype: string): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: filename, // vd: "1785400000-faq-shopvn.md"
          folder: 'ai-customer-support/kb-documents',
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload thất bại: ${error?.message}`);
            return reject(error ?? new Error('Cloudinary upload trả về kết quả rỗng'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (error) {
      this.logger.warn(
        `Xoá file Cloudinary thất bại (không chặn luồng chính): ${(error as Error).message}`,
      );
    }
  }

  async download(fileRef: string): Promise<Buffer> {
    // fileRef ở đây là URL (secure_url) đã lưu trong KnowledgeDocument.filePath.
    const response = await fetch(fileRef);
    if (!response.ok) {
      throw new Error(
        `Tải file từ Cloudinary thất bại (${response.status}): ${fileRef}. ` +
          `Nếu là 401, kiểm tra Dashboard → Settings → Security → đã bỏ tick "Restricted media types: PDF and ZIP" chưa.`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
