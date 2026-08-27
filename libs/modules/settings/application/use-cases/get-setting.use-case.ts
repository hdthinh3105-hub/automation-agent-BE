import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_SETTING_REPOSITORY,
  ISystemSettingRepository,
} from '../ports/system-setting-repository.port';
import { SettingResponseDto } from '../dto/setting.dto';

@Injectable()
export class GetSettingUseCase {
  constructor(
    @Inject(SYSTEM_SETTING_REPOSITORY)
    private readonly systemSettingRepository: ISystemSettingRepository,
  ) {}

  async execute(key: string): Promise<SettingResponseDto | null> {
    const setting = await this.systemSettingRepository.findByKey(key);
    if (!setting) return null;
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      category: setting.category,
      label: setting.label,
      updatedAt: setting.updatedAt,
    };
  }
}
