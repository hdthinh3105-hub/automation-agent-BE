import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { Conversation } from '../../domain/entities/conversation.entity';
import { ConversationTurn } from '../../domain/entities/conversation-turn.entity';
import { IConversationRepository } from '../../application/ports/conversation-repository.port';
import { ConversationMapper } from './conversation.mapper';

@Injectable()
export class PrismaConversationRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTicketId(ticketId: string): Promise<Conversation | null> {
    const record = await this.prisma.conversation.findUnique({ where: { ticketId } });
    return record ? ConversationMapper.toDomain(record) : null;
  }

  async save(conversation: Conversation): Promise<void> {
    const data = ConversationMapper.toPersistence(conversation);
    await this.prisma.conversation.upsert({
      where: { id: data.id },
      create: data,
      update: {
        summary: data.summary,
        turnCount: data.turnCount,
        lastActivityAt: data.lastActivityAt,
      },
    });
  }

  async appendTurn(turn: ConversationTurn): Promise<void> {
    const data = ConversationMapper.turnToPersistence(turn);
    await this.prisma.conversationTurn.create({ data });
  }

  async getRecentTurns(conversationId: string, limit: number): Promise<ConversationTurn[]> {
    const records = await this.prisma.conversationTurn.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records.reverse().map(ConversationMapper.turnToDomain);
  }
}
