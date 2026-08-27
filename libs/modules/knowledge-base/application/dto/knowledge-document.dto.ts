import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@app/shared/dto/pagination.dto';

export class UploadDocumentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t) => t.trim()) : value,
  )
  tags?: string[];
}

export class ListDocumentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() tag?: string;
}

export class DocumentResponseDto {
  id!: string;
  title!: string;
  status!: string;
  version!: number;
  tags!: string[];
  createdAt!: Date;
}
