import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: (process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true',
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '20', 10),
}));

export const storageConfig = registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER ?? 'local',
  localPath: process.env.STORAGE_LOCAL_PATH ?? './storage/documents',
  maxUploadSizeBytes: parseInt(
    process.env.STORAGE_MAX_UPLOAD_SIZE_BYTES ?? `${10 * 1024 * 1024}`,
    10,
  ),
}));

export const llmConfig = registerAs('llm', () => ({
  groqApiKey: process.env.GROQ_API_KEY || undefined,
  groqModel: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  // "gemini-1.5-flash"/"gemini-2.0-flash" đã bị Google shutdown hẳn
  // (01/06/2026); "gemini-2.5-flash" bị chặn cấp cho project/API key
  // mới. "gemini-flash-latest" là alias Google tự trỏ sang model ổn
  // định mới nhất còn active — tránh phải sửa code mỗi lần Google
  // deprecate model cụ thể (rủi ro đã ghi ở TDD Mục 15).
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
}));

export const embeddingConfig = registerAs('embedding', () => ({
  provider: process.env.EMBEDDING_PROVIDER ?? 'local',
  model: process.env.EMBEDDING_MODEL ?? 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? '384', 10),
}));

export const ragConfig = registerAs('rag', () => ({
  chunkSizeTokens: parseInt(process.env.CHUNK_SIZE_TOKENS ?? '500', 10),
  chunkOverlapTokens: parseInt(process.env.CHUNK_OVERLAP_TOKENS ?? '75', 10),
  topKRetrieval: parseInt(process.env.RAG_TOP_K_RETRIEVAL ?? '15', 10),
  topKFinal: parseInt(process.env.RAG_TOP_K_FINAL ?? '5', 10),
  embeddingBatchSize: parseInt(process.env.RAG_EMBEDDING_BATCH_SIZE ?? '16', 10),
  confidenceEscalationThreshold: parseFloat(
    process.env.AI_CONFIDENCE_ESCALATION_THRESHOLD ?? '0.6',
  ),
  spamScoreThreshold: parseFloat(process.env.SPAM_SCORE_THRESHOLD ?? '0.8'),
}));

export const queueConfig = registerAs('queue', () => ({
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisTls: (process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true',
}));

export const telegramConfig = registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
  pollingEnabled: (process.env.TELEGRAM_POLLING_ENABLED ?? 'false').toLowerCase() === 'true',
}));

export const emailConfig = registerAs('email', () => ({
  gmailUser: process.env.GMAIL_USER || undefined,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || undefined,
  gmailClientId: process.env.GMAIL_CLIENT_ID || undefined,
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || undefined,
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN || undefined,
  pollingEnabled: (process.env.EMAIL_POLLING_ENABLED ?? 'false').toLowerCase() === 'true',
}));

export const notificationConfig = registerAs('notification', () => ({
  adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || undefined,
  smtpHost: process.env.SMTP_HOST || undefined,
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpUser: process.env.SMTP_USER || undefined,
  smtpPass: process.env.SMTP_PASS || undefined,
  smtpFrom: process.env.SMTP_FROM || undefined,
}));

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || undefined,
  apiKey: process.env.CLOUDINARY_API_KEY || undefined,
  apiSecret: process.env.CLOUDINARY_API_SECRET || undefined,
}));
