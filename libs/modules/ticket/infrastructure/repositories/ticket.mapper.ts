import {
  Ticket as PrismaTicket,
  TicketMessage as PrismaTicketMessage,
  TicketStatusHistory as PrismaTicketStatusHistory,
  Channel as PrismaChannel,
  TicketStatus as PrismaTicketStatus,
  PriorityLevel as PrismaPriorityLevel,
  MessageSender as PrismaMessageSender,
  Prisma,
} from '@prisma/client';
import { Ticket } from '../../domain/entities/ticket.entity';
import { TicketMessage } from '../../domain/entities/ticket-message.entity';
import { TicketStatusHistory } from '../../domain/entities/ticket-status-history.entity';
import { TicketStatus } from '../../domain/value-objects/ticket-status.vo';
import { PriorityLevel } from '../../domain/value-objects/priority-level.vo';
import { Channel } from '../../domain/value-objects/channel.vo';
import { MessageSender } from '../../domain/value-objects/message-sender.vo';

/**
 * Giống hệt lý do tồn tại của UserMapper (Identity Module): Prisma tự
 * sinh `$Enums.*` là type nominal khác với enum tự viết ở Domain, dù
 * value string trùng nhau — mapper là nơi DUY NHẤT được biết cả 2 phía.
 */
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

export class TicketMapper {
  static toDomain(record: PrismaTicket): Ticket {
    return Ticket.reconstitute({
      id: record.id,
      customerId: record.customerId,
      channel: assertKnownEnumValue(Channel, record.channel, 'Channel'),
      subject: record.subject,
      status: assertKnownEnumValue(TicketStatus, record.status, 'TicketStatus'),
      category: record.category,
      priority: record.priority
        ? assertKnownEnumValue(PriorityLevel, record.priority, 'PriorityLevel')
        : null,
      confidenceScore: record.confidenceScore,
      assignedAgentId: record.assignedAgentId,
      isSpam: record.isSpam,
      isDuplicateOf: record.isDuplicateOf,
      missingInfoFlags: record.missingInfoFlags,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
    });
  }

  static toPersistence(ticket: Ticket) {
    return {
      id: ticket.id,
      customerId: ticket.customerId,
      channel: ticket.channel as unknown as PrismaChannel,
      subject: ticket.subject,
      status: ticket.status as unknown as PrismaTicketStatus,
      category: ticket.category,
      priority: (ticket.priority as unknown as PrismaPriorityLevel) ?? null,
      confidenceScore: ticket.confidenceScore,
      assignedAgentId: ticket.assignedAgentId,
      isSpam: ticket.isSpam,
      isDuplicateOf: ticket.isDuplicateOf,
      missingInfoFlags: ticket.missingInfoFlags,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    };
  }

  static messageToDomain(record: PrismaTicketMessage): TicketMessage {
    return TicketMessage.reconstitute({
      id: record.id,
      ticketId: record.ticketId,
      sender: assertKnownEnumValue(MessageSender, record.sender, 'MessageSender'),
      content: record.content,
      attachments: record.attachments,
      channelMetadata: record.channelMetadata as Record<string, unknown> | null,
      createdAt: record.createdAt,
    });
  }

  static messageToPersistence(message: TicketMessage) {
    return {
      id: message.id,
      ticketId: message.ticketId,
      sender: message.sender as unknown as PrismaMessageSender,
      content: message.content,
      attachments: message.attachments,
      channelMetadata: (message.channelMetadata as Prisma.InputJsonValue) ?? undefined,
      createdAt: message.createdAt,
    };
  }

  static historyToPersistence(history: TicketStatusHistory) {
    return {
      id: history.id,
      ticketId: history.ticketId,
      fromStatus: history.fromStatus as unknown as PrismaTicketStatus,
      toStatus: history.toStatus as unknown as PrismaTicketStatus,
      changedBy: history.changedBy,
      reason: history.reason,
      changedAt: history.changedAt,
    };
  }

  static historyToDomain(record: PrismaTicketStatusHistory): TicketStatusHistory {
    return TicketStatusHistory.reconstitute({
      id: record.id,
      ticketId: record.ticketId,
      fromStatus: assertKnownEnumValue(TicketStatus, record.fromStatus, 'TicketStatus'),
      toStatus: assertKnownEnumValue(TicketStatus, record.toStatus, 'TicketStatus'),
      changedBy: record.changedBy,
      reason: record.reason,
      changedAt: record.changedAt,
    });
  }
}
