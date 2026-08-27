export const DASHBOARD_READ_REPOSITORY = Symbol('DASHBOARD_READ_REPOSITORY');

export interface OverviewStats {
  totalTickets: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  autoResolveRate: number;
  escalationRate: number;
}

export interface TrendPoint {
  date: string;
  totalTickets: number;
  autoResolvedCount: number;
  escalatedCount: number;
  avgConfidence: number | null;
}

export interface AiPerformanceStats {
  avgConfidence: number | null;
  autoResolveRate: number;
  escalationRate: number;
}

export interface IDashboardReadRepository {
  getOverview(): Promise<OverviewStats>;
  getTrends(from: Date, to: Date): Promise<TrendPoint[]>;
  getAiPerformance(): Promise<AiPerformanceStats>;
}
