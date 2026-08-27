import { Module } from '@nestjs/common';
import { CATEGORY_REPOSITORY } from './application/ports/category-repository.port';
import { ROUTING_RULE_REPOSITORY } from './application/ports/routing-rule-repository.port';
import { AGENT_READ_REPOSITORY } from './application/ports/agent-read-repository.port';
import { PrismaCategoryRepository } from './infrastructure/repositories/prisma-category.repository';
import { PrismaRoutingRuleRepository } from './infrastructure/repositories/prisma-routing-rule.repository';
import { PrismaAgentReadRepository } from './infrastructure/repositories/prisma-agent-read.repository';
import { ManageCategoriesUseCase } from './application/use-cases/manage-categories.use-case';
import { ManageAgentsUseCase } from './application/use-cases/manage-agents.use-case';
import { ViewSystemConfigUseCase } from './application/use-cases/view-system-config.use-case';
import { ManageRoutingRulesUseCase } from './application/use-cases/manage-routing-rules.use-case';
import { AdminController } from './presentation/controllers/admin.controller';

@Module({
  controllers: [AdminController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: ROUTING_RULE_REPOSITORY, useClass: PrismaRoutingRuleRepository },
    { provide: AGENT_READ_REPOSITORY, useClass: PrismaAgentReadRepository },
    ManageCategoriesUseCase,
    ManageAgentsUseCase,
    ViewSystemConfigUseCase,
    ManageRoutingRulesUseCase,
  ],
  exports: [CATEGORY_REPOSITORY, ROUTING_RULE_REPOSITORY, AGENT_READ_REPOSITORY],
})
export class AdminModule {}
