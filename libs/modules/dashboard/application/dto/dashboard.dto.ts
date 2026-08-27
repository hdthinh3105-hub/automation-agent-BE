import { IsDateString, IsOptional } from 'class-validator';

export class TrendQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class OverviewStatsDto {
  totalTickets!: number;
  byStatus!: Record<string, number>;
  byPriority!: Record<string, number>;
  autoResolveRate!: number;
  escalationRate!: number;
}

export class TrendDto {
  date!: string;
  totalTickets!: number;
  autoResolvedCount!: number;
  escalatedCount!: number;
  avgConfidence!: number | null;
}

export class AiPerformanceDto {
  avgConfidence!: number | null;
  autoResolveRate!: number;
  escalationRate!: number;
}
