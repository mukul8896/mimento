import { createZodDto } from 'nestjs-zod';
import {
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
  MediaAssetSchema,
} from '@momentpath/contracts';

export class CreateUploadRequestDto extends createZodDto(CreateUploadRequestSchema) {}
export class CreateUploadResponseDto extends createZodDto(CreateUploadResponseSchema) {}
export class MediaAssetDto extends createZodDto(MediaAssetSchema) {}
