import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from '@app/config';
import { PrismaModule, QueueModule, StorageModule } from '@app/infrastructure';
import { KnowledgeBaseModule } from '@app/modules/knowledge-base';
import { RagModule } from '@app/modules/rag';
import { GmailChannelAdapter } from '@app/modules/ticket';
import { NotificationModule } from '@app/modules/notification';
import { JobsProcessor } from './workers/jobs.processor';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueueModule,
    StorageModule, // MỚI — bắt buộc, Worker cần FILE_STORAGE để download file khi extract text
    EventEmitterModule.forRoot(),
    KnowledgeBaseModule,
    RagModule,
    NotificationModule, // dispatcher + repository cho job notification.send
  ],
  providers: [JobsProcessor, GmailChannelAdapter],
})
export class WorkerModule {}
