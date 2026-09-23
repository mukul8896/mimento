import { createZodDto } from 'nestjs-zod';
import {
  CreateExperienceRequestSchema,
  DraftDocumentSchema,
  ExperienceDetailSchema,
  ExperienceListQuerySchema,
  ExperienceListResponseSchema,
  ManageLinkResponseSchema,
  SetExpiryRequestSchema,
  UpdateDraftRequestSchema,
  UpdateDraftResponseSchema,
} from '@momentpath/contracts';

export class CreateExperienceRequestDto extends createZodDto(CreateExperienceRequestSchema) {}
export class ExperienceListQueryDto extends createZodDto(ExperienceListQuerySchema) {}
export class ExperienceListResponseDto extends createZodDto(ExperienceListResponseSchema) {}
export class ExperienceDetailDto extends createZodDto(ExperienceDetailSchema) {}
export class DraftDocumentDto extends createZodDto(DraftDocumentSchema) {}
export class UpdateDraftRequestDto extends createZodDto(UpdateDraftRequestSchema) {}
export class UpdateDraftResponseDto extends createZodDto(UpdateDraftResponseSchema) {}
export class SetExpiryRequestDto extends createZodDto(SetExpiryRequestSchema) {}

export class ManageLinkResponseDto extends createZodDto(ManageLinkResponseSchema) {}
