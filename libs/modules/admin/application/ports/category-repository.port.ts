import { Category } from '../../domain/entities/category.entity';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface ICategoryRepository {
  list(): Promise<Category[]>;
  findByName(name: string): Promise<Category | null>;
  create(category: Category): Promise<void>;
  deactivate(id: string): Promise<void>;
  findById(id: string): Promise<Category | null>;
}
