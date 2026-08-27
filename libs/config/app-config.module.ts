import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  throttleConfig,
  storageConfig,
  llmConfig,
  embeddingConfig,
  ragConfig,
  queueConfig,
  telegramConfig,
  emailConfig,
  notificationConfig,
  cloudinaryConfig,
} from './configuration';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        throttleConfig,
        storageConfig,
        llmConfig,
        embeddingConfig,
        ragConfig,
        queueConfig,
        telegramConfig,
        emailConfig,
        notificationConfig,
        cloudinaryConfig,
      ],
    }),
  ],
})
export class AppConfigModule {}
