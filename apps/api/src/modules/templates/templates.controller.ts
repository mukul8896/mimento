import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { TemplateListResponseSchema } from '@momentpath/contracts';
import { TemplatesService } from './templates.service';

class TemplateListResponseDto extends createZodDto(TemplateListResponseSchema) {}

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @ZodResponse({ status: 200, type: TemplateListResponseDto })
  list() {
    return this.templates.list();
  }
}
