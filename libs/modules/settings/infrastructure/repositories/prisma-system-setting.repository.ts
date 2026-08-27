import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { SystemSetting } from '../../domain/entities/system-setting.entity';
import { ISystemSettingRepository } from '../../application/ports/system-setting-repository.port';
import { SystemSettingMapper } from './system-setting.mapper';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PrismaSystemSettingRepository implements ISystemSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<SystemSetting | null> {
    const record = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!record) return null;
    return SystemSettingMapper.toDomain(record);
  }

  async list(category?: string): Promise<SystemSetting[]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    const records = await this.prisma.systemSetting.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(SystemSettingMapper.toDomain);
  }

  async upsert(key: string, value: any, category?: string, label?: string): Promise<SystemSetting> {
    const record = await this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        id: uuid(),
        key,
        value: value as any,
        category: category ?? 'general',
        label: label ?? null,
      },
      update: {
        value: value as any,
        ...(category !== undefined && { category }),
        ...(label !== undefined && { label }),
      },
    });
    return SystemSettingMapper.toDomain(record);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.systemSetting.delete({ where: { key } });
  }
}
