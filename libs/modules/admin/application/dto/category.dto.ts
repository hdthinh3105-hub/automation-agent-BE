import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CategoryResponseDto {
  id!: string;
  name!: string;
  isActive!: boolean;
  createdAt!: Date;
}
