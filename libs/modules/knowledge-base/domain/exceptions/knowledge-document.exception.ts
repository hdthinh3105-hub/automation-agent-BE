import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';

export class DocumentNotFoundException extends DomainException {
  constructor(id: string) {
    super(ErrorCode.DOCUMENT_NOT_FOUND, `Document with id "${id}" was not found`, { id });
  }
}

export class DocumentInvalidFormatException extends DomainException {
  constructor(mimetype: string) {
    super(ErrorCode.DOCUMENT_INVALID_FORMAT, `Unsupported file type: ${mimetype}`, { mimetype });
  }
}

export class DocumentTooLargeException extends DomainException {
  constructor(sizeBytes: number, maxBytes: number) {
    super(ErrorCode.DOCUMENT_TOO_LARGE, 'File exceeds the maximum allowed size', {
      sizeBytes,
      maxBytes,
    });
  }
}

/**
 * Ném ra khi request `POST /kb/documents` thiếu file đính kèm (field
 * `file` rỗng/không tồn tại) — thường gặp khi client (Postman) gửi
 * multipart nhưng file thực tế không đọc được (đường dẫn file đã chọn
 * không còn tồn tại trên máy). Trả 422 rõ ràng thay vì để crash 500
 * ("Cannot read properties of undefined (reading 'mimetype')").
 */
export class DocumentFileRequiredException extends DomainException {
  constructor() {
    super(
      ErrorCode.DOCUMENT_INVALID_FORMAT,
      'A file is required — the "file" field was empty or missing from the multipart request',
      {},
    );
  }
}
