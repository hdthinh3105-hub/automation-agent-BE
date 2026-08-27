import { Module } from '@nestjs/common';
import { TicketModule } from '@app/modules/ticket';
import { ESCALATION_REPOSITORY } from './application/ports/escalation-repository.port';
import { PrismaEscalationRepository } from './infrastructure/repositories/prisma-escalation.repository';
import { CreateEscalationUseCase } from './application/use-cases/create-escalation.use-case';
import { AcknowledgeEscalationUseCase } from './application/use-cases/acknowledge-escalation.use-case';
import { ResolveEscalationUseCase } from './application/use-cases/resolve-escalation.use-case';
import { ListEscalationsUseCase } from './application/use-cases/list-escalations.use-case';
import { EscalationController } from './presentation/controllers/escalation.controller';

@Module({
  imports: [TicketModule],
  controllers: [EscalationController],
  providers: [
    { provide: ESCALATION_REPOSITORY, useClass: PrismaEscalationRepository },
    CreateEscalationUseCase,
    AcknowledgeEscalationUseCase,
    ResolveEscalationUseCase,
    ListEscalationsUseCase,
  ],
  exports: [CreateEscalationUseCase, ESCALATION_REPOSITORY],
})
export class EscalationModule {}
