import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRoutingRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsObject()
  @IsNotEmpty()
  conditions!: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class UpdateRoutingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  action?: string;
}

export class RoutingRuleResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  isActive!: boolean;
  priority!: number;
  conditions!: Record<string, unknown>;
  action!: string;
  createdBy!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
