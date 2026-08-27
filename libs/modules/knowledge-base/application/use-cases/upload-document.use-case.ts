import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { FILE_STORAGE, IFileStorage } from '@app/infrastructure';
import {
  KNOWLEDGE_DOCUMENT_REPOSITORY,
  IKnowledgeDocumentRepository,
} from '../ports/knowledge-document-repository.port';
import {
  KnowledgeDocument,
  DocumentSourceType,
} from '../../domain/entities/knowledge-document.entity';
import {
  DocumentInvalidFormatException,
  DocumentTooLargeException,
  DocumentFileRequiredException,
} from '../../domain/exceptions/knowledge-document.exception';
import { DocumentResponseDto } from '../dto/knowledge-document.dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class UploadDocumentUseCase {
  constructor(
    @Inject(KNOWLEDGE_DOCUMENT_REPOSITORY)
    private readonly documentRepository: IKnowledgeDocumentRepository,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    file: Express.Multer.File,
    title: string,
    tags: string[] | undefined,
    uploadedBy: string,
  ): Promise<DocumentResponseDto> {
    if (!file || !file.buffer || file.size === 0) {
      throw new DocumentFileRequiredException();
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new DocumentInvalidFormatException(file.mimetype);
    }

    const maxSizeBytes = this.configService.get<number>('storage.maxUploadSizeBytes')!;
    if (file.size > maxSizeBytes) {
      throw new DocumentTooLargeException(file.size, maxSizeBytes);
    }

    const storedFileName = `${Date.now()}-${file.originalname}`;
    const uploaded = await this.fileStorage.upload(file.buffer, storedFileName, file.mimetype);

    const document = KnowledgeDocument.create({
      id: uuid(),
      title,
      sourceType: DocumentSourceType.FILE,
      filePath: uploaded.url, // giờ là URL Cloudinary thay vì đường dẫn local
      tags,
      uploadedBy,
    });
    await this.documentRepository.save(document);

    for (const event of document.domainEvents) {
      this.eventEmitter.emit(event.eventName, event);
    }
    document.clearDomainEvents();

    return {
      id: document.id,
      title: document.title,
      status: document.status,
      version: document.version,
      tags: document.tags,
      createdAt: document.createdAt,
    };
  }
}
