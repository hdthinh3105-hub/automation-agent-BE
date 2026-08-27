import { SystemSetting } from '../../domain/entities/system-setting.entity';

export const SYSTEM_SETTING_REPOSITORY = Symbol('SYSTEM_SETTING_REPOSITORY');

export interface ISystemSettingRepository {
  findByKey(key: string): Promise<SystemSetting | null>;
  list(category?: string): Promise<SystemSetting[]>;
  upsert(key: string, value: any, category?: string, label?: string): Promise<SystemSetting>;
  delete(key: string): Promise<void>;
}
