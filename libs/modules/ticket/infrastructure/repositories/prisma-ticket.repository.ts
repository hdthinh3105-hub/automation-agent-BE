import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { Ticket } from '../../domain/entities/ticket.entity';
import { TicketMessage } from '../../domain/entities/ticket-message.entity';
import { TicketStatusHistory } from '../../domain/entities/ticket-status-history.entity';
import { ITicketRepository } from '../../application/ports/repository.ports';
import { TicketMapper } from './ticket.mapper';

@Injectable()
export class PrismaTicketRepository implements ITicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(ticket: Ticket): Promise<void> {
    const data = TicketMapper.toPersistence(ticket);
    await this.prisma.ticket.upsert({
      where: { id: data.id },
      create: data,
      update: {
        status: data.status,
        category: data.category,
        priority: data.priority,
        confidenceScore: data.confidenceScore,
        assignedAgentId: data.assignedAgentId,
        isSpam: data.isSpam,
        isDuplicateOf: data.isDuplicateOf,
        missingInfoFlags: data.missingInfoFlags,
        updatedAt: data.updatedAt,
        resolvedAt: data.resolvedAt,
      },
    });
  }

  async findById(id: string): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findUnique({ where: { id } });
    return record ? TicketMapper.toDomain(record) : null;
  }

  async saveMessage(message: TicketMessage): Promise<void> {
    const data = TicketMapper.messageToPersistence(message);
    await this.prisma.ticketMessage.create({ data });
  }

  async saveStatusHistory(history: TicketStatusHistory): Promise<void> {
    const data = TicketMapper.historyToPersistence(history);
    await this.prisma.ticketStatusHistory.create({ data });
  }

  async findMessages(ticketId: string): Promise<TicketMessage[]> {
    const records = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((record) => TicketMapper.messageToDomain(record));
  }

  async findRecentByCustomer(
    customerId: string,
    sinceDate: Date,
    excludeTicketId: string,
  ): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: {
        customerId,
        id: { not: excludeTicketId },
        createdAt: { gte: sinceDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return records.map((record) => TicketMapper.toDomain(record));
  }
}
