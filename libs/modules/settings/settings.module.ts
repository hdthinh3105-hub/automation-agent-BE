import { Module } from '@nestjs/common';
import { SYSTEM_SETTING_REPOSITORY } from './application/ports/system-setting-repository.port';
import { PrismaSystemSettingRepository } from './infrastructure/repositories/prisma-system-setting.repository';
import { GetSettingUseCase } from './application/use-cases/get-setting.use-case';
import { ListSettingsUseCase } from './application/use-cases/list-settings.use-case';
import { UpdateSettingUseCase } from './application/use-cases/update-setting.use-case';
import { DeleteSettingUseCase } from './application/use-cases/delete-setting.use-case';
import { SettingsController } from './presentation/controllers/settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [
    { provide: SYSTEM_SETTING_REPOSITORY, useClass: PrismaSystemSettingRepository },
    GetSettingUseCase,
    ListSettingsUseCase,
    UpdateSettingUseCase,
    DeleteSettingUseCase,
  ],
  exports: [SYSTEM_SETTING_REPOSITORY],
})
export class SettingsModule {}
