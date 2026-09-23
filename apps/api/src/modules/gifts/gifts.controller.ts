import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { GiftSecretRequestDto, GiftSecretResponseDto } from './dto';
import { GiftsService } from './gifts.service';

/** Owner-only editing of the encrypted surprise details for a draft gift step. */
@ApiTags('gifts')
@ApiBearerAuth()
@Controller('experiences/:experienceId/draft/gifts/:stepKey')
export class GiftsController {
  constructor(private readonly gifts: GiftsService) {}

  @Get()
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: GiftSecretResponseDto })
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('experienceId', ParseUUIDPipe) experienceId: string,
    @Param('stepKey', ParseUUIDPipe) stepKey: string,
  ) {
    return this.gifts.getDraftSecret(principal, experienceId, stepKey);
  }

  @Put()
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: GiftSecretResponseDto })
  put(
    @CurrentPrincipal() principal: Principal,
    @Param('experienceId', ParseUUIDPipe) experienceId: string,
    @Param('stepKey', ParseUUIDPipe) stepKey: string,
    @Body() body: GiftSecretRequestDto,
  ) {
    return this.gifts.setDraftSecret(principal, experienceId, stepKey, body.secret);
  }
}
