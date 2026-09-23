import { createZodDto } from 'nestjs-zod';
import { GiftSecretRequestSchema, GiftSecretResponseSchema } from '@momentpath/contracts';

export class GiftSecretRequestDto extends createZodDto(GiftSecretRequestSchema) {}
export class GiftSecretResponseDto extends createZodDto(GiftSecretResponseSchema) {}
