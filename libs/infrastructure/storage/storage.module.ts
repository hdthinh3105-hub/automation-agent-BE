import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from './storage.port';
import { CloudinaryFileStorage } from './cloudinary-file-storage.provider';
import { LocalFileStorage } from './local-file-storage.provider';

@Global()
@Module({
  providers: [
    CloudinaryFileStorage,
    LocalFileStorage,
    {
      provide: FILE_STORAGE,
      useFactory: (
        configService: ConfigService,
        cloud: CloudinaryFileStorage,
        local: LocalFileStorage,
      ) => (configService.get<string>('storage.driver', 'local') === 'cloudinary' ? cloud : local),
      inject: [ConfigService, CloudinaryFileStorage, LocalFileStorage],
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
