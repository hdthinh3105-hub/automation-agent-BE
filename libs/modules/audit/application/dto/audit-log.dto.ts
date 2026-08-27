import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/shared/dto/pagination.dto';

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsString() actorId?: string;
}

export class AuditLogResponseDto {
  id!: string;
  actorType!: string;
  actorId!: string | null;
  action!: string;
  resourceType!: string;
  resourceId!: string;
  changesJson!: Record<string, unknown> | null;
  createdAt!: Date;
}
