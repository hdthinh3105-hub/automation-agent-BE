import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from '@app/config';
import { PrismaModule, QueueModule, StorageModule } from '@app/infrastructure';
import { KnowledgeBaseModule } from '@app/modules/knowledge-base';
import { RagModule } from '@app/modules/rag';
import { GmailChannelAdapter } from '@app/modules/ticket';
import { DocumentParserProcessor } from './workers/document-parser.processor';
import { EmbeddingProcessor } from './workers/embedding.processor';
import { EmailProcessor } from './workers/email.processor';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueueModule,
    StorageModule, // MỚI — bắt buộc, Worker cần FILE_STORAGE để download file khi extract text
    EventEmitterModule.forRoot(),
    KnowledgeBaseModule,
    RagModule,
  ],
  providers: [DocumentParserProcessor, EmbeddingProcessor, GmailChannelAdapter, EmailProcessor],
})
export class WorkerModule {}
