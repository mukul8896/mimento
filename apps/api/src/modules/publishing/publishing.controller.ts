import { Controller, Get, Header, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import {
  PublishCheckResponseSchema,
  PublishResponseSchema,
  ShareLinkResponseSchema,
} from '@momentpath/contracts';
import { Idempotent } from '../../common/idempotency';
import { requestId } from '../../common/request';
import { CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { PublishingService } from './publishing.service';

class PublishCheckResponseDto extends createZodDto(PublishCheckResponseSchema) {}
class PublishResponseDto extends createZodDto(PublishResponseSchema) {}
class ShareLinkResponseDto extends createZodDto(ShareLinkResponseSchema) {}

@ApiTags('publishing')
@ApiBearerAuth()
@Controller('experiences/:id')
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post('publish-check')
  @ZodResponse({ status: 200, type: PublishCheckResponseDto })
  check(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.publishing.check(p, id);
  }

  @Post('publish')
  @Idempotent()
  @ZodResponse({ status: 200, type: PublishResponseDto })
  publish(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.publishing.publish(p, id, requestId(req));
  }

  @Get('share-link')
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: ShareLinkResponseDto })
  shareLink(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.publishing.shareLink(p, id);
  }

  @Post('share-link/rotate')
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: ShareLinkResponseDto })
  rotate(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.publishing.rotateShareLink(p, id, requestId(req));
  }
}
