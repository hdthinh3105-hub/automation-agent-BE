import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_SETTING_REPOSITORY,
  ISystemSettingRepository,
} from '../ports/system-setting-repository.port';
import { UpsertSettingDto, SettingResponseDto } from '../dto/setting.dto';

@Injectable()
export class UpdateSettingUseCase {
  constructor(
    @Inject(SYSTEM_SETTING_REPOSITORY)
    private readonly systemSettingRepository: ISystemSettingRepository,
  ) {}

  async execute(dto: UpsertSettingDto): Promise<SettingResponseDto> {
    const setting = await this.systemSettingRepository.upsert(
      dto.key,
      dto.value,
      dto.category,
      dto.label,
    );
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
