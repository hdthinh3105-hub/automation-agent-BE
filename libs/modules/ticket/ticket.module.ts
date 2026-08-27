import { Module } from '@nestjs/common';
import { CustomerModule } from '@app/modules/customer';
import { TICKET_REPOSITORY, TICKET_READ_REPOSITORY } from './application/ports/repository.ports';
import { PrismaTicketRepository } from './infrastructure/repositories/prisma-ticket.repository';
import { PrismaTicketReadRepository } from './infrastructure/repositories/prisma-ticket-read.repository';
import { WebChannelAdapter } from './infrastructure/adapters/web-channel.adapter';
import { TelegramChannelAdapter } from './infrastructure/adapters/telegram-channel.adapter';
import { EmailChannelAdapter } from './infrastructure/adapters/email-channel.adapter';
import { GmailChannelAdapter } from './infrastructure/adapters/gmail-channel.adapter';
import { GmailPollingService } from './infrastructure/services/gmail-polling.service';
import { TelegramUpdateProcessor } from './infrastructure/services/telegram-update.processor';
import { TelegramPollingService } from './infrastructure/services/telegram-polling.service';
import { TicketStateMachineService } from './domain/services/ticket-state-machine.service';
import { CreateTicketUseCase } from './application/use-cases/create-ticket.use-case';
import { UpdateTicketStatusUseCase } from './application/use-cases/update-ticket-status.use-case';
import { AddCustomerMessageUseCase } from './application/use-cases/add-customer-message.use-case';
import {
  ListTicketsUseCase,
  GetTicketDetailUseCase,
} from './application/use-cases/ticket-queries.use-case';
import { GetTicketPublicUseCase } from './application/use-cases/get-ticket-public.use-case';
import { TicketController } from './presentation/controllers/ticket.controller';
import { TelegramWebhookController } from './presentation/controllers/telegram-webhook.controller';
import { EmailWebhookController } from './presentation/controllers/email-webhook.controller';
import { ConversationModule } from '@app/modules/conversation';

@Module({
  imports: [CustomerModule, ConversationModule],
  controllers: [TicketController, TelegramWebhookController, EmailWebhookController],
  providers: [
    { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository },
    { provide: TICKET_READ_REPOSITORY, useClass: PrismaTicketReadRepository },
    WebChannelAdapter,
    TelegramChannelAdapter,
    EmailChannelAdapter,
    GmailChannelAdapter,
    GmailPollingService,
    TelegramUpdateProcessor,
    TelegramPollingService,
    TicketStateMachineService,
    CreateTicketUseCase,
    UpdateTicketStatusUseCase,
    AddCustomerMessageUseCase,
    ListTicketsUseCase,
    GetTicketDetailUseCase,
    GetTicketPublicUseCase,
  ],
  exports: [TICKET_REPOSITORY, TICKET_READ_REPOSITORY],
})
export class TicketModule {}
