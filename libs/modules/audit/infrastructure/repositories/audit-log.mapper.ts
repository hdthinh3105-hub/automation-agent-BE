import { AuditLog as PrismaAuditLog, ActorType as PrismaActorType, Prisma } from '@prisma/client';
import { AuditLog, ActorType } from '../../domain/entities/audit-log.entity';

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

export class AuditLogMapper {
  static toDomain(record: PrismaAuditLog): AuditLog {
    return AuditLog.reconstitute({
      id: record.id,
      actorType: assertKnownEnumValue(ActorType, record.actorType, 'ActorType'),
      actorId: record.actorId,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      changesJson: record.changesJson as Record<string, unknown> | null,
      ipAddress: record.ipAddress,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(log: AuditLog) {
    return {
      id: log.id,
      actorType: log.actorType as unknown as PrismaActorType,
      actorId: log.actorId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      // Prisma sinh kiểu JSON field (`changesJson`) là
      // `NullableJsonNullValueInput | InputJsonValue | undefined` —
      // KHÔNG chấp nhận `Record<string, unknown>` thuần dù cấu trúc dữ
      // liệu tương thích, vì `InputJsonValue` là union kiểu (string |
      // number | boolean | object | array | null) không trùng khớp
      // structurally với interface tự viết. Ép kiểu qua
      // `Prisma.InputJsonValue` là cách chuẩn Prisma khuyến nghị cho
      // trường hợp này (giống `TicketMapper.messageToPersistence` đã
      // làm với `channelMetadata`).
      changesJson: (log.changesJson as Prisma.InputJsonValue) ?? undefined,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }
}
