/**
 * Tên queue + job tập trung (TDD Mục 12). Production gộp 4 queue cũ
 * (document-parser/embedding/email/notification) thành 1 queue `jobs`
 * duy nhất, phân biệt loại việc bằng job name — để vừa quota Upstash
 * free-tier 500k lệnh/tháng: mỗi worker idle long-poll tốn ~1 lệnh Redis
 * mỗi `drainDelay` giây, 1 worker rẻ hơn 4 worker rất nhiều. Job mới vẫn
 * được đánh thức ngay qua pub/sub, không chờ hết drain.
 */
export const JOBS_QUEUE = 'jobs';

export const JOB_PARSE_DOCUMENT = 'document.parse';
export const JOB_EMBED_CHUNKS = 'chunks.embed';
export const JOB_SEND_EMAIL = 'email.send';
export const JOB_SEND_NOTIFICATION = 'notification.send';

export interface DocumentParserJobData {
  documentId: string;
}

export interface EmbeddingJobData {
  documentId: string;
}

/** Ngày 4 — GmailChannelAdapter.sendMail() enqueue, worker gửi thật (trả lời khách qua Gmail). */
export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
}

/** Ngày 5 — SendNotificationUseCase enqueue, worker gửi thật (báo Agent/Admin). */
export interface NotificationJobData {
  notificationLogId: string;
}

export type JobsQueueData =
  | DocumentParserJobData
  | EmbeddingJobData
  | EmailJobData
  | NotificationJobData;
