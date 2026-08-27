export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface UploadedFile {
  /** URL công khai (hoặc có thể ký) dùng để tải lại file sau này. */
  url: string;
  /** ID nội bộ của provider — dùng khi cần xoá file. */
  publicId: string;
}

/**
 * 🔌 Port — trừu tượng hoá nơi lưu file gốc (TDD Mục 5.19: "File
 * Storage: Local Filesystem (dev) → MinIO/Cloud (deploy)"). Việc tách
 * port này giải quyết đúng vấn đề đã gặp: API lưu file trên đĩa cục bộ
 * của chính nó, Worker (chạy trên container/instance khác trên Render)
 * không đọc được. Với adapter Cloud (Cloudinary/S3/MinIO), cả API lẫn
 * Worker đều tải file qua HTTPS từ 1 nơi lưu trữ chung — không còn phụ
 * thuộc vào việc 2 process có chung filesystem hay không.
 */
export interface IFileStorage {
  upload(buffer: Buffer, filename: string, mimetype: string): Promise<UploadedFile>;
  delete(publicId: string): Promise<void>;
  /** Tải lại nội dung file (dùng bởi Document Parser Worker để extract text). */
  download(fileRef: string): Promise<Buffer>;
}
