export const AGENT_READ_REPOSITORY = Symbol('AGENT_READ_REPOSITORY');

export interface AgentListFilter {
  role?: string;
  page: number;
  limit: number;
}

export interface AgentReadRecord {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export interface IAgentReadRepository {
  list(filter: AgentListFilter): Promise<AgentReadRecord[]>;
  count(filter: AgentListFilter): Promise<number>;
}
