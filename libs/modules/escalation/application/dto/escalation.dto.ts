import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/shared/dto/pagination.dto';

export class CreateEscalationDto {
  @IsUUID()
  ticketId!: string;

  @IsIn(['LOW_CONFIDENCE', 'EXPLICIT_REQUEST', 'POLICY_RULE', 'COMPLEX_CASE'])
  reason!: string;
}

export class ResolveEscalationDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class ListEscalationsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignedAgentId?: string;
}

export class EscalationResponseDto {
  id!: string;
  ticketId!: string;
  reason!: string;
  assignedAgentId!: string | null;
  slaDeadline!: Date;
  status!: string;
  resolutionNote!: string | null;
  createdAt!: Date;
  acknowledgedAt!: Date | null;
  resolvedAt!: Date | null;
}
