import { IsDefined, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertSettingDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsDefined()
  value!: any;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class SettingResponseDto {
  id!: string;
  key!: string;
  value!: any;
  category!: string;
  label!: string | null;
  updatedAt!: Date;
}
