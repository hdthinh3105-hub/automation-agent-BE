import { NotificationLog } from '../../domain/entities/notification-log.entity';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');

export interface INotificationLogRepository {
  save(log: NotificationLog): Promise<void>;
  findById(id: string): Promise<NotificationLog | null>;
}
