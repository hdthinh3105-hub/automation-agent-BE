import {
  Prisma,
  NotificationLog as PrismaNotificationLog,
  NotificationChannel as PrismaNotificationChannel,
  NotificationStatus as PrismaNotificationStatus,
} from '@prisma/client';
import {
  NotificationLog,
  NotificationChannel,
  NotificationStatus,
} from '../../domain/entities/notification-log.entity';

function assertKnownEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: string,
  label: string,
): T[keyof T] {
  if (!Object.values(enumObj).includes(value as T[keyof T])) {
    throw new Error(`Unknown ${label} value from DB: ${value}`);
  }
  return value as T[keyof T];
}

export class NotificationLogMapper {
  static toDomain(record: PrismaNotificationLog): NotificationLog {
    return NotificationLog.reconstitute({
      id: record.id,
      type: record.type,
      recipient: record.recipient,
      channel: assertKnownEnumValue(NotificationChannel, record.channel, 'NotificationChannel'),
      status: assertKnownEnumValue(NotificationStatus, record.status, 'NotificationStatus'),
      payload: record.payload as Record<string, unknown> | null,
      errorReason: record.errorReason,
      createdAt: record.createdAt,
      sentAt: record.sentAt,
    });
  }

  /**
   * `payload` là `Record<string, unknown> | null` ở Domain nhưng Prisma
   * đòi `Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput`
   * (KHÔNG chấp nhận `undefined`/`Record<string, unknown>` thẳng —
   * Prisma tự sinh type chặt hơn TypeScript object thường cho cột
   * `Json?`). Ép qua `Prisma.InputJsonValue` khi có giá trị, dùng
   * `Prisma.JsonNull` (không phải SQL NULL — là JSON `null` hợp lệ)
   * khi không có, để khớp đúng type Prisma sinh ra.
   */
  static toPersistence(log: NotificationLog) {
    return {
      id: log.id,
      type: log.type,
      recipient: log.recipient,
      channel: log.channel as unknown as PrismaNotificationChannel,
      status: log.status as unknown as PrismaNotificationStatus,
      payload: (log.payload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      errorReason: log.errorReason,
      createdAt: log.createdAt,
      sentAt: log.sentAt,
    };
  }
}
