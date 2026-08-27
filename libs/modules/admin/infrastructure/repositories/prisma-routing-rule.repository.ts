import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { RoutingRule } from '../../domain/entities/routing-rule.entity';
import { IRoutingRuleRepository } from '../../application/ports/routing-rule-repository.port';
import { RoutingRuleMapper } from './routing-rule.mapper';

@Injectable()
export class PrismaRoutingRuleRepository implements IRoutingRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoutingRule[]> {
    const records = await this.prisma.routingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(RoutingRuleMapper.toDomain);
  }

  async findById(id: string): Promise<RoutingRule | null> {
    const record = await this.prisma.routingRule.findUnique({ where: { id } });
    return record ? RoutingRuleMapper.toDomain(record) : null;
  }

  async create(rule: RoutingRule): Promise<void> {
    const data = RoutingRuleMapper.toPersistence(rule);
    await this.prisma.routingRule.create({ data });
  }

  async update(rule: RoutingRule): Promise<void> {
    const data = RoutingRuleMapper.toPersistence(rule);
    await this.prisma.routingRule.update({
      where: { id: rule.id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.routingRule.delete({ where: { id } });
  }
}
