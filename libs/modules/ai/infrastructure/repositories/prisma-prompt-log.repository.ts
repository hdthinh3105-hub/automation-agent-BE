import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PromptLog } from '../../domain/entities/prompt-log.entity';
import { IPromptLogRepository } from '../../application/ports/prompt-log-repository.port';
import { PromptLogMapper } from './prompt-log.mapper';

@Injectable()
export class PrismaPromptLogRepository implements IPromptLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(promptLog: PromptLog): Promise<void> {
    const data = PromptLogMapper.toPersistence(promptLog);
    await this.prisma.promptLog.create({ data });
  }
}
