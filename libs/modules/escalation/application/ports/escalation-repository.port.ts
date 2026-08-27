import { Escalation } from '../../domain/entities/escalation.entity';

export const ESCALATION_REPOSITORY = Symbol('ESCALATION_REPOSITORY');

export interface ListEscalationsFilter {
  status?: string;
  assignedAgentId?: string;
  page: number;
  limit: number;
}

export interface IEscalationRepository {
  save(escalation: Escalation): Promise<void>;
  findById(id: string): Promise<Escalation | null>;
  list(filter: ListEscalationsFilter): Promise<{ items: Escalation[]; totalItems: number }>;
}
