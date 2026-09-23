import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { ResultsResponseSchema } from '@momentpath/contracts';
import { CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { ResultsService } from './results.service';

class ResultsResponseDto extends createZodDto(ResultsResponseSchema) {}

@ApiTags('responses')
@ApiBearerAuth()
@Controller('experiences/:id/results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: ResultsResponseDto })
  get(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.results.results(principal, id);
  }
}
