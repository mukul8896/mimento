import { Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../../config/env';
import { OBJECT_STORAGE, type ObjectStorage } from '../../providers/storage';
import { MediaBlobController } from './media-blob.controller';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FilesystemStorage } from './storage/filesystem-storage';
import { S3Storage } from './storage/s3-storage';

export function createStorage(env: AppEnv): ObjectStorage {
  if (env.STORAGE_DRIVER === 's3') {
    return new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET ?? '',
      accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return new FilesystemStorage(
    env.STORAGE_FS_ROOT,
    env.STORAGE_SIGNING_SECRET ?? '',
    env.MEDIA_PUBLIC_BASE_URL ?? '',
  );
}

@Module({
  controllers: [MediaController, MediaBlobController],
  providers: [
    MediaService,
    { provide: OBJECT_STORAGE, useFactory: createStorage, inject: [APP_ENV] },
  ],
  exports: [MediaService, OBJECT_STORAGE],
})
export class MediaModule {}
