import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '@app/shared/decorators/public.decorator';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { CurrentUser, AuthenticatedUser } from '@app/shared/decorators/current-user.decorator';
import { PaginatedResult } from '@app/shared/dto/pagination.dto';
import {
  CreateTicketDto,
  AddCustomerMessageDto,
  UpdateTicketStatusDto,
  ListTicketsQueryDto,
  TicketResponseDto,
  TicketMessageResponseDto,
  TicketPublicResponseDto,
} from '../../application/dto/ticket.dto';
import { CreateTicketUseCase } from '../../application/use-cases/create-ticket.use-case';
import { UpdateTicketStatusUseCase } from '../../application/use-cases/update-ticket-status.use-case';
import { AddCustomerMessageUseCase } from '../../application/use-cases/add-customer-message.use-case';
import {
  ListTicketsUseCase,
  GetTicketDetailUseCase,
} from '../../application/use-cases/ticket-queries.use-case';
import { GetTicketPublicUseCase } from '../../application/use-cases/get-ticket-public.use-case';
import { WebChannelAdapter } from '../../infrastructure/adapters/web-channel.adapter';
import { TicketStatus } from '../../domain/value-objects/ticket-status.vo';
import { TicketListItem } from '../../application/ports/repository.ports';

@Controller('tickets')
export class TicketController {
  constructor(
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly updateTicketStatusUseCase: UpdateTicketStatusUseCase,
    private readonly addCustomerMessageUseCase: AddCustomerMessageUseCase,
    private readonly listTicketsUseCase: ListTicketsUseCase,
    private readonly getTicketDetailUseCase: GetTicketDetailUseCase,
    private readonly getTicketPublicUseCase: GetTicketPublicUseCase,
    private readonly webChannelAdapter: WebChannelAdapter,
  ) {}

  /**
   * Public — khách hàng tạo ticket không cần login (TDD Mục 5.2, 11.3).
   * Đi qua WebChannelAdapter dù request tới thẳng REST — giữ đúng
   * nguyên tắc "mọi kênh hội tụ về 1 Use Case" (Mục 5.3), chỉ khác nơi
   * gọi `parseIncoming`.
   */
  @Public()
  @Post()
  async create(@Body() dto: CreateTicketDto): Promise<TicketResponseDto> {
    const command = this.webChannelAdapter.parseIncoming(dto);
    return this.createTicketUseCase.execute(command);
  }

  @Public()
  @Post(':id/messages')
  async addCustomerMessage(
    @Param('id') id: string,
    @Body() dto: AddCustomerMessageDto,
  ): Promise<TicketMessageResponseDto> {
    return this.addCustomerMessageUseCase.execute(id, dto.content);
  }

  /**
   * Public — Web Chat Widget đọc lại hội thoại (status + messages) sau
   * khi tạo ticket, KHÔNG cần JWT (TDD Mục 5.3). Route có 2 segment
   * (`:id/public`) nên không đụng route `:id` phía dưới (1 segment).
   */
  @Public()
  @Get(':id/public')
  async detailPublic(@Param('id') id: string): Promise<TicketPublicResponseDto> {
    return this.getTicketPublicUseCase.execute(id);
  }

  @Get()
  @Roles(Role.AGENT, Role.ADMIN)
  async list(@Query() query: ListTicketsQueryDto): Promise<PaginatedResult<TicketListItem>> {
    return this.listTicketsUseCase.execute({
      status: query.status,
      priority: query.priority,
      category: query.category,
      assignedAgentId: query.assignedAgentId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':id')
  @Roles(Role.AGENT, Role.ADMIN)
  async detail(@Param('id') id: string) {
    return this.getTicketDetailUseCase.execute(id);
  }

  @Patch(':id/status')
  @Roles(Role.AGENT, Role.ADMIN)
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    return this.updateTicketStatusUseCase.execute({
      ticketId: id,
      targetStatus: dto.status as TicketStatus,
      changedBy: user.userId,
      reason: dto.reason,
    });
  }
}
