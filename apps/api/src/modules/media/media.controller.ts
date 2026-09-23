import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { CreateUploadRequestDto, CreateUploadResponseDto, MediaAssetDto } from './dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('experiences/:experienceId/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Returns a short-lived signed upload URL. The file is validated on completion. */
  @Post('uploads')
  @ZodResponse({ status: 201, type: CreateUploadResponseDto })
  createUpload(
    @CurrentPrincipal() principal: Principal,
    @Param('experienceId', ParseUUIDPipe) experienceId: string,
    @Body() body: CreateUploadRequestDto,
  ) {
    return this.media.createUpload(principal, experienceId, body.contentType, body.sizeBytes);
  }

  @Post(':mediaId/complete')
  @ZodResponse({ status: 200, type: MediaAssetDto })
  complete(
    @CurrentPrincipal() principal: Principal,
    @Param('experienceId', ParseUUIDPipe) experienceId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.media.completeUpload(principal, experienceId, mediaId);
  }
}
