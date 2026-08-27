import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { PaginatedResult } from '@app/shared/dto/pagination.dto';
import { ListAuditLogsQueryDto, AuditLogResponseDto } from '../../application/dto/audit-log.dto';
import { QueryAuditLogsUseCase } from '../../application/use-cases/query-audit-logs.use-case';

@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly queryAuditLogsUseCase: QueryAuditLogsUseCase) {}

  @Get()
  @Roles(Role.ADMIN)
  async list(@Query() query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLogResponseDto>> {
    return this.queryAuditLogsUseCase.execute({
      resourceType: query.resourceType,
      actorId: query.actorId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
