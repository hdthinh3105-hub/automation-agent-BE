import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '@app/config';
import { PrismaModule, QueueModule } from '@app/infrastructure';
import { GlobalExceptionFilter, ResponseInterceptor } from '@app/shared';
import { IdentityModule, JwtAuthGuard, RolesGuard } from '@app/modules/identity';
import { CustomerModule } from '@app/modules/customer';
import { TicketModule } from '@app/modules/ticket';
import { ConversationModule } from '@app/modules/conversation';
import { KnowledgeBaseModule } from '@app/modules/knowledge-base';
import { RagModule } from '@app/modules/rag';
import { RoutingModule } from '@app/modules/routing';
import { EscalationModule } from '@app/modules/escalation';
import { AiModule } from '@app/modules/ai';
import { AuditModule } from '@app/modules/audit';
import { NotificationModule } from '@app/modules/notification';
import { DashboardModule } from '@app/modules/dashboard';
import { MonitoringModule } from '@app/modules/monitoring';
import { AdminModule } from '@app/modules/admin';
import { SettingsModule } from '@app/modules/settings';
import { AppController } from './app.controller';
import { StorageModule } from '@app/infrastructure';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueueModule,
    StorageModule, // MỚI
    // `wildcard: true` bắt buộc cho AuditListenerService (`@OnEvent('**')`,
    // TDD Mục 5.11, Ngày 5).
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
      },
    }),
    IdentityModule,
    CustomerModule,
    TicketModule,
    ConversationModule,
    KnowledgeBaseModule,
    RagModule,
    RoutingModule,
    EscalationModule,
    AiModule,
    // Ngày 5 (Phase 8+9, TDD Mục 14):
    AuditModule,
    NotificationModule,
    DashboardModule,
    MonitoringModule,
    AdminModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
