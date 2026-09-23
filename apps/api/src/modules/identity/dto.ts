import { createZodDto } from 'nestjs-zod';
import { MeResponseSchema, OwnerTokenResponseSchema } from '@momentpath/contracts';

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
export class OwnerTokenResponseDto extends createZodDto(OwnerTokenResponseSchema) {}
