import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '@app/shared/decorators/roles.decorator';
import { Role } from '@app/shared/types/role.enum';
import { UpsertSettingDto, SettingResponseDto } from '../../application/dto/setting.dto';
import { GetSettingUseCase } from '../../application/use-cases/get-setting.use-case';
import { ListSettingsUseCase } from '../../application/use-cases/list-settings.use-case';
import { UpdateSettingUseCase } from '../../application/use-cases/update-setting.use-case';
import { DeleteSettingUseCase } from '../../application/use-cases/delete-setting.use-case';

@Controller('admin/settings')
export class SettingsController {
  constructor(
    private readonly getSettingUseCase: GetSettingUseCase,
    private readonly listSettingsUseCase: ListSettingsUseCase,
    private readonly updateSettingUseCase: UpdateSettingUseCase,
    private readonly deleteSettingUseCase: DeleteSettingUseCase,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  async list(@Query('category') category?: string): Promise<SettingResponseDto[]> {
    return this.listSettingsUseCase.execute(category);
  }

  @Get(':key')
  @Roles(Role.ADMIN)
  async get(@Param('key') key: string): Promise<SettingResponseDto> {
    const result = await this.getSettingUseCase.execute(key);
    if (!result) {
      return null as any;
    }
    return result;
  }

  @Put()
  @Roles(Role.ADMIN)
  async upsert(@Body() dto: UpsertSettingDto): Promise<SettingResponseDto> {
    return this.updateSettingUseCase.execute(dto);
  }

  @Delete(':key')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('key') key: string): Promise<void> {
    await this.deleteSettingUseCase.execute(key);
  }
}
