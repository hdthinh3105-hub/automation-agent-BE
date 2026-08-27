import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { Category } from '../../domain/entities/category.entity';
import { ICategoryRepository } from '../../application/ports/category-repository.port';
import { CategoryMapper } from './category.mapper';

@Injectable()
export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map(CategoryMapper.toDomain);
  }

  async findByName(name: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { name } });
    return record ? CategoryMapper.toDomain(record) : null;
  }

  async create(category: Category): Promise<void> {
    const data = CategoryMapper.toPersistence(category);
    await this.prisma.category.create({ data });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } });
    return record ? CategoryMapper.toDomain(record) : null;
  }
}
