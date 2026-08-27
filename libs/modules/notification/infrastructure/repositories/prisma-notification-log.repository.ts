import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { NotificationLog } from '../../domain/entities/notification-log.entity';
import { INotificationLogRepository } from '../../application/ports/notification-log-repository.port';
import { NotificationLogMapper } from './notification-log.mapper';

@Injectable()
export class PrismaNotificationLogRepository implements INotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(log: NotificationLog): Promise<void> {
    const data = NotificationLogMapper.toPersistence(log);
    await this.prisma.notificationLog.upsert({
      where: { id: data.id },
      create: data,
      update: { status: data.status, errorReason: data.errorReason, sentAt: data.sentAt },
    });
  }

  async findById(id: string): Promise<NotificationLog | null> {
    const record = await this.prisma.notificationLog.findUnique({ where: { id } });
    return record ? NotificationLogMapper.toDomain(record) : null;
  }
}
