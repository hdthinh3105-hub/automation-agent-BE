import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CATEGORY_REPOSITORY, ICategoryRepository } from '../ports/category-repository.port';
import { Category } from '../../domain/entities/category.entity';
import { CreateCategoryDto, CategoryResponseDto } from '../dto/category.dto';

@Injectable()
export class ManageCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async list(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.list();
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.categoryRepository.findByName(dto.name);
    if (existing) {
      throw new Error(`Category with name "${dto.name}" already exists`);
    }
    const category = Category.create({ id: uuid(), name: dto.name });
    await this.categoryRepository.create(category);
    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  async deactivate(id: string): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new Error(`Category with id "${id}" not found`);
    }
    category.deactivate();
    await this.categoryRepository.deactivate(id);
    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }
}
