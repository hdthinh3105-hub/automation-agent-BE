import { Category as PrismaCategory } from '@prisma/client';
import { Category } from '../../domain/entities/category.entity';

export class CategoryMapper {
  static toDomain(record: PrismaCategory): Category {
    return Category.reconstitute({
      id: record.id,
      name: record.name,
      isActive: record.isActive,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(category: Category) {
    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }
}
