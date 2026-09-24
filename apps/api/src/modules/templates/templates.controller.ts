import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { TemplateListResponseSchema, TemplatePreviewSchema } from '@momentpath/contracts';
import { Public } from '../identity/decorators';
import { TemplatesService } from './templates.service';

class TemplateListResponseDto extends createZodDto(TemplateListResponseSchema) {}
class TemplatePreviewDto extends createZodDto(TemplatePreviewSchema) {}

/** Public: the landing page and gallery show templates before anyone has created anything. */
@ApiTags('templates')
@Public()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @ZodResponse({ status: 200, type: TemplateListResponseDto })
  list() {
    return this.templates.list();
  }

  @Get(':key/preview')
  @ZodResponse({ status: 200, type: TemplatePreviewDto })
  preview(@Param('key') key: string) {
    return this.templates.preview(key.slice(0, 60));
  }
}
