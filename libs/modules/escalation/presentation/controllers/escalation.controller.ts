import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { CurrentUser, AuthenticatedUser } from '@app/shared/decorators/current-user.decorator';
import { PaginatedResult } from '@app/shared/dto/pagination.dto';
import {
  CreateEscalationDto,
  ResolveEscalationDto,
  ListEscalationsQueryDto,
  EscalationResponseDto,
} from '../../application/dto/escalation.dto';
import { CreateEscalationUseCase } from '../../application/use-cases/create-escalation.use-case';
import { AcknowledgeEscalationUseCase } from '../../application/use-cases/acknowledge-escalation.use-case';
import { ResolveEscalationUseCase } from '../../application/use-cases/resolve-escalation.use-case';
import { ListEscalationsUseCase } from '../../application/use-cases/list-escalations.use-case';

@Controller('escalations')
export class EscalationController {
  constructor(
    private readonly createEscalationUseCase: CreateEscalationUseCase,
    private readonly acknowledgeEscalationUseCase: AcknowledgeEscalationUseCase,
    private readonly resolveEscalationUseCase: ResolveEscalationUseCase,
    private readonly listEscalationsUseCase: ListEscalationsUseCase,
  ) {}

  /**
   * Tương đương `/tickets/:id/escalate` ở TDD Mục 11.3, nhưng đặt ở
   * Escalation Module (thay vì thêm endpoint vào TicketController) để
   * tránh Ticket Module phải phụ thuộc ngược vào Escalation Module
   * (TDD Mục 2.4 — module boundary chỉ 1 chiều).
   */
  @Post()
  @Roles(Role.AGENT, Role.ADMIN)
  async create(
    @Body() dto: CreateEscalationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EscalationResponseDto> {
    return this.createEscalationUseCase.execute({
      ticketId: dto.ticketId,
      reason: dto.reason,
      actorId: user.userId,
    });
  }

  @Get()
  @Roles(Role.AGENT, Role.ADMIN)
  async list(
    @Query() query: ListEscalationsQueryDto,
  ): Promise<PaginatedResult<EscalationResponseDto>> {
    return this.listEscalationsUseCase.execute({
      status: query.status,
      assignedAgentId: query.assignedAgentId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Post(':id/acknowledge')
  @Roles(Role.AGENT, Role.ADMIN)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EscalationResponseDto> {
    return this.acknowledgeEscalationUseCase.execute(id, user.userId);
  }

  @Patch(':id/resolve')
  @Roles(Role.AGENT, Role.ADMIN)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveEscalationDto,
  ): Promise<EscalationResponseDto> {
    return this.resolveEscalationUseCase.execute(id, dto.resolutionNote);
  }
}
