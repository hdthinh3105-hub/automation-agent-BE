import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_SETTING_REPOSITORY,
  ISystemSettingRepository,
} from '../ports/system-setting-repository.port';
import { SettingResponseDto } from '../dto/setting.dto';

@Injectable()
export class ListSettingsUseCase {
  constructor(
    @Inject(SYSTEM_SETTING_REPOSITORY)
    private readonly systemSettingRepository: ISystemSettingRepository,
  ) {}

  async execute(category?: string): Promise<SettingResponseDto[]> {
    const settings = await this.systemSettingRepository.list(category);
    return settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value,
      category: s.category,
      label: s.label,
      updatedAt: s.updatedAt,
    }));
  }
}
