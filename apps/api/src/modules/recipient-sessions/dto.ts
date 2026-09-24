import { createZodDto } from 'nestjs-zod';
import {
  AcceptedResponseSchema,
  PublicExperienceMetaSchema,
  ReportAbuseRequestSchema,
  RevealGiftRequestSchema,
  RevealGiftResponseSchema,
  SessionStateResponseSchema,
  ShortLinkSessionRequestSchema,
  ShortLinkSessionResponseSchema,
  StartSessionRequestSchema,
  SubmitAnswerRequestSchema,
  SubmitAnswerResponseSchema,
} from '@momentpath/contracts';

export class PublicExperienceMetaDto extends createZodDto(PublicExperienceMetaSchema) {}
export class SessionStateResponseDto extends createZodDto(SessionStateResponseSchema) {}
export class SubmitAnswerRequestDto extends createZodDto(SubmitAnswerRequestSchema) {}
export class SubmitAnswerResponseDto extends createZodDto(SubmitAnswerResponseSchema) {}
export class RevealGiftRequestDto extends createZodDto(RevealGiftRequestSchema) {}
export class RevealGiftResponseDto extends createZodDto(RevealGiftResponseSchema) {}
export class ReportAbuseRequestDto extends createZodDto(ReportAbuseRequestSchema) {}
export class AcceptedResponseDto extends createZodDto(AcceptedResponseSchema) {}
export class StartSessionRequestDto extends createZodDto(StartSessionRequestSchema) {}
export class ShortLinkSessionRequestDto extends createZodDto(ShortLinkSessionRequestSchema) {}
export class ShortLinkSessionResponseDto extends createZodDto(ShortLinkSessionResponseSchema) {}
