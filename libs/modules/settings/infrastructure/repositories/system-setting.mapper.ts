import { SystemSetting as PrismaSystemSetting, Prisma } from '@prisma/client';
import { SystemSetting } from '../../domain/entities/system-setting.entity';

export class SystemSettingMapper {
  static toDomain(record: PrismaSystemSetting): SystemSetting {
    return SystemSetting.reconstitute({
      id: record.id,
      key: record.key,
      value: record.value,
      category: record.category,
      label: record.label,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(setting: SystemSetting) {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value as Prisma.InputJsonValue,
      category: setting.category,
      label: setting.label,
      updatedAt: setting.updatedAt,
    };
  }
}
