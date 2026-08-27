import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@app/shared/dto/pagination.dto';
import { Role } from '@app/shared/types/role.enum';

export class ListAgentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class AgentResponseDto {
  id!: string;
  email!: string;
  role!: string;
  isActive!: boolean;
  createdAt!: Date;
}
