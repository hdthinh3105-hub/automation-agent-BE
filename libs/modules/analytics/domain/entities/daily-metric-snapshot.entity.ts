import { Entity } from '@app/shared/base/entity.base';

export interface DailyMetricSnapshotProps {
  date: Date;
  totalTickets: number;
  autoResolvedCount: number;
  escalatedCount: number;
  avgConfidence: number | null;
  avgResponseTimeMs: number | null;
  byCategory: Record<string, number> | null;
  createdAt: Date;
}

/**
 * 📦 Entity — 1 bản ghi tổng hợp theo ngày (TDD Mục 5.14). `date` dùng
 * làm khoá chính — mỗi ngày chỉ có đúng 1 snapshot, tính lại (upsert)
 * an toàn nếu chạy lại (idempotent, TDD Mục 12).
 */
export class DailyMetricSnapshot extends Entity<string> {
  private props: DailyMetricSnapshotProps;

  private constructor(props: DailyMetricSnapshotProps) {
    super(props.date.toISOString());
    this.props = props;
  }

  public static create(params: {
    date: Date;
    totalTickets: number;
    autoResolvedCount: number;
    escalatedCount: number;
    avgConfidence: number | null;
    avgResponseTimeMs: number | null;
    byCategory: Record<string, number> | null;
  }): DailyMetricSnapshot {
    return new DailyMetricSnapshot({ ...params, createdAt: new Date() });
  }

  public static reconstitute(props: DailyMetricSnapshotProps): DailyMetricSnapshot {
    return new DailyMetricSnapshot(props);
  }

  public get date(): Date {
    return this.props.date;
  }
  public get totalTickets(): number {
    return this.props.totalTickets;
  }
  public get autoResolvedCount(): number {
    return this.props.autoResolvedCount;
  }
  public get escalatedCount(): number {
    return this.props.escalatedCount;
  }
  public get avgConfidence(): number | null {
    return this.props.avgConfidence;
  }
  public get avgResponseTimeMs(): number | null {
    return this.props.avgResponseTimeMs;
  }
  public get byCategory(): Record<string, number> | null {
    return this.props.byCategory;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
