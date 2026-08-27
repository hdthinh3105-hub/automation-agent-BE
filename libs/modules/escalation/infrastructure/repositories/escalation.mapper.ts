import {
  Escalation as PrismaEscalation,
  EscalationReason as PrismaEscalationReason,
  EscalationStatus as PrismaEscalationStatus,
} from '@prisma/client';
import {
  Escalation,
  EscalationReason,
  EscalationStatus,
} from '../../domain/entities/escalation.entity';

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

export class EscalationMapper {
  static toDomain(record: PrismaEscalation): Escalation {
    return Escalation.reconstitute({
      id: record.id,
      ticketId: record.ticketId,
      reason: assertKnownEnumValue(EscalationReason, record.reason, 'EscalationReason'),
      assignedAgentId: record.assignedAgentId,
      slaDeadline: record.slaDeadline,
      status: assertKnownEnumValue(EscalationStatus, record.status, 'EscalationStatus'),
      resolutionNote: record.resolutionNote,
      createdAt: record.createdAt,
      acknowledgedAt: record.acknowledgedAt,
      resolvedAt: record.resolvedAt,
    });
  }

  static toPersistence(escalation: Escalation) {
    return {
      id: escalation.id,
      ticketId: escalation.ticketId,
      reason: escalation.reason as unknown as PrismaEscalationReason,
      assignedAgentId: escalation.assignedAgentId,
      slaDeadline: escalation.slaDeadline,
      status: escalation.status as unknown as PrismaEscalationStatus,
      resolutionNote: escalation.resolutionNote,
      createdAt: escalation.createdAt,
      acknowledgedAt: escalation.acknowledgedAt,
      resolvedAt: escalation.resolvedAt,
    };
  }
}
