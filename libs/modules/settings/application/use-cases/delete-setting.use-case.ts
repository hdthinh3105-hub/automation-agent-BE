import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SYSTEM_SETTING_REPOSITORY,
  ISystemSettingRepository,
} from '../ports/system-setting-repository.port';

@Injectable()
export class DeleteSettingUseCase {
  constructor(
    @Inject(SYSTEM_SETTING_REPOSITORY)
    private readonly systemSettingRepository: ISystemSettingRepository,
  ) {}

  async execute(key: string): Promise<void> {
    const existing = await this.systemSettingRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    await this.systemSettingRepository.delete(key);
  }
}
