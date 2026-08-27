import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { IFileStorage, UploadedFile } from './storage.port';

/** Giữ nguyên hành vi cũ cho local dev (docker-compose, không cần Cloudinary). */
@Injectable()
export class LocalFileStorage implements IFileStorage {
  constructor(private readonly configService: ConfigService) {}

  async upload(buffer: Buffer, filename: string): Promise<UploadedFile> {
    const storageDir = this.configService.get<string>('storage.localPath')!;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const fullPath = path.join(storageDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return { url: fullPath, publicId: fullPath };
  }

  async delete(publicId: string): Promise<void> {
    if (fs.existsSync(publicId)) fs.unlinkSync(publicId);
  }

  async download(fileRef: string): Promise<Buffer> {
    return fs.readFileSync(fileRef);
  }
}
