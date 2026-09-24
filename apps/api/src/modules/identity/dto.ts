import { createZodDto } from 'nestjs-zod';
import {
  MeResponseSchema,
  OwnerTokenResponseSchema,
  PasskeyListResponseSchema,
  PasskeyLoginRequestSchema,
  PasskeyOptionsResponseSchema,
  PasskeyRegisterRequestSchema,
  PasskeySchema,
} from '@momentpath/contracts';

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
export class OwnerTokenResponseDto extends createZodDto(OwnerTokenResponseSchema) {}
export class PasskeyDto extends createZodDto(PasskeySchema) {}
export class PasskeyListResponseDto extends createZodDto(PasskeyListResponseSchema) {}
export class PasskeyOptionsResponseDto extends createZodDto(PasskeyOptionsResponseSchema) {}
export class PasskeyRegisterRequestDto extends createZodDto(PasskeyRegisterRequestSchema) {}
export class PasskeyLoginRequestDto extends createZodDto(PasskeyLoginRequestSchema) {}
