import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { PaginatedResult } from '@app/shared/dto/pagination.dto';
import { CreateCategoryDto, CategoryResponseDto } from '../../application/dto/category.dto';
import { ListAgentsQueryDto, AgentResponseDto } from '../../application/dto/agent.dto';
import {
  CreateRoutingRuleDto,
  UpdateRoutingRuleDto,
  RoutingRuleResponseDto,
} from '../../application/dto/routing-rule.dto';
import { ManageCategoriesUseCase } from '../../application/use-cases/manage-categories.use-case';
import { ManageAgentsUseCase } from '../../application/use-cases/manage-agents.use-case';
import {
  ViewSystemConfigUseCase,
  SystemConfigResponse,
} from '../../application/use-cases/view-system-config.use-case';
import { ManageRoutingRulesUseCase } from '../../application/use-cases/manage-routing-rules.use-case';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly manageCategoriesUseCase: ManageCategoriesUseCase,
    private readonly manageAgentsUseCase: ManageAgentsUseCase,
    private readonly viewSystemConfigUseCase: ViewSystemConfigUseCase,
    private readonly manageRoutingRulesUseCase: ManageRoutingRulesUseCase,
  ) {}

  @Get('categories')
  @Roles(Role.ADMIN)
  async listCategories(): Promise<CategoryResponseDto[]> {
    return this.manageCategoriesUseCase.list();
  }

  @Post('categories')
  @Roles(Role.ADMIN)
  async createCategory(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.manageCategoriesUseCase.create(dto);
  }

  @Patch('categories/:id/deactivate')
  @Roles(Role.ADMIN)
  async deactivateCategory(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.manageCategoriesUseCase.deactivate(id);
  }

  @Get('agents')
  @Roles(Role.ADMIN)
  async listAgents(@Query() query: ListAgentsQueryDto): Promise<PaginatedResult<AgentResponseDto>> {
    return this.manageAgentsUseCase.list(query);
  }

  @Get('config')
  @Roles(Role.ADMIN)
  async viewSystemConfig(): Promise<SystemConfigResponse> {
    return this.viewSystemConfigUseCase.execute();
  }

  @Get('routing-rules')
  @Roles(Role.ADMIN)
  async listRoutingRules(): Promise<RoutingRuleResponseDto[]> {
    return this.manageRoutingRulesUseCase.list();
  }

  @Post('routing-rules')
  @Roles(Role.ADMIN)
  async createRoutingRule(@Body() dto: CreateRoutingRuleDto): Promise<RoutingRuleResponseDto> {
    return this.manageRoutingRulesUseCase.create(dto);
  }

  @Patch('routing-rules/:id')
  @Roles(Role.ADMIN)
  async updateRoutingRule(
    @Param('id') id: string,
    @Body() dto: UpdateRoutingRuleDto,
  ): Promise<RoutingRuleResponseDto> {
    return this.manageRoutingRulesUseCase.update(id, dto);
  }

  @Delete('routing-rules/:id')
  @Roles(Role.ADMIN)
  async deleteRoutingRule(@Param('id') id: string): Promise<void> {
    return this.manageRoutingRulesUseCase.delete(id);
  }
}
