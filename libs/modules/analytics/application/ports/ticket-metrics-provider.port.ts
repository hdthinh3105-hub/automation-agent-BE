export const TICKET_METRICS_PROVIDER = Symbol('TICKET_METRICS_PROVIDER');

export interface DailyTicketMetrics {
  totalTickets: number;
  autoResolvedCount: number;
  escalatedCount: number;
  avgConfidence: number | null;
  avgResponseTimeMs: number | null;
  byCategory: Record<string, number>;
}

export interface ITicketMetricsProvider {
  computeForDay(dayStart: Date, dayEnd: Date): Promise<DailyTicketMetrics>;
}
