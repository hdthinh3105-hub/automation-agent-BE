import { DailyMetricSnapshot } from '../../domain/entities/daily-metric-snapshot.entity';

export const METRIC_SNAPSHOT_REPOSITORY = Symbol('METRIC_SNAPSHOT_REPOSITORY');

export interface IMetricSnapshotRepository {
  upsert(snapshot: DailyMetricSnapshot): Promise<void>;
  listRange(from: Date, to: Date): Promise<DailyMetricSnapshot[]>;
}
