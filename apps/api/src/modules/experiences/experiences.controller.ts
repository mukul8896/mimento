import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import { Idempotent } from '../../common/idempotency';
import { requestId } from '../../common/request';
import { CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import {
  CreateExperienceRequestDto,
  DraftDocumentDto,
  ExperienceDetailDto,
  ExperienceListQueryDto,
  ExperienceListResponseDto,
  InProgressResponseDto,
  AccessSettingsDto,
  ManageLinkResponseDto,
  UpdateAccessRequestDto,
  RestoreVersionResponseDto,
  SetExpiryRequestDto,
  UpdateDraftRequestDto,
  UpdateDraftResponseDto,
  VersionListResponseDto,
} from './dto';
import { ExperienceLifecycleService } from './experience-lifecycle.service';
import { ExperiencesService } from './experiences.service';

@ApiTags('experiences')
@Controller('experiences')
export class ExperiencesController {
  constructor(
    private readonly experiences: ExperiencesService,
    private readonly lifecycle: ExperienceLifecycleService,
  ) {}

  @Get()
  @ZodResponse({ status: 200, type: ExperienceListResponseDto })
  list(@CurrentPrincipal() principal: Principal, @Query() query: ExperienceListQueryDto) {
    return this.experiences.list(principal, query);
  }

  /** Surprises this browser started and changed but has not published (see in-progress rules). */
  @Get('in-progress')
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: InProgressResponseDto })
  inProgress(@CurrentPrincipal() principal: Principal) {
    return this.experiences.inProgress(principal);
  }

  @Post()
  @ZodResponse({ status: 201, type: ExperienceDetailDto })
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateExperienceRequestDto,
    @Req() req: Request,
  ) {
    return this.experiences.create(principal, body, requestId(req));
  }

  /** The creator's recovery link for this experience. Never cached, never listed. */
  @Get(':id/manage-link')
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: ManageLinkResponseDto })
  manageLink(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.experiences.manageLink(principal, id);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: ExperienceDetailDto })
  detail(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.experiences.detail(principal, id);
  }

  /** "Customize with PRO": unlocks the full builder for a template-based draft. */
  @Post(':id/customize')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ExperienceDetailDto })
  customize(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.experiences.customize(principal, id, requestId(req));
  }

  /** Scheduled opening, recipient PIN and short link. */
  @Put(':id/access')
  @ZodResponse({ status: 200, type: AccessSettingsDto })
  access(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAccessRequestDto,
    @Req() req: Request,
  ) {
    return this.experiences.updateAccess(principal, id, body, requestId(req));
  }

  @Get(':id/versions')
  @ZodResponse({ status: 200, type: VersionListResponseDto })
  versions(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.experiences.versions(principal, id);
  }

  @Post(':id/versions/:number/restore')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: RestoreVersionResponseDto })
  restore(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('number', ParseIntPipe) number: number,
    @Req() req: Request,
  ) {
    return this.experiences.restoreVersion(principal, id, number, requestId(req));
  }

  @Get(':id/draft')
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: DraftDocumentDto })
  draft(@CurrentPrincipal() principal: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.experiences.getDraft(principal, id);
  }

  @Put(':id/draft')
  @ZodResponse({ status: 200, type: UpdateDraftResponseDto })
  saveDraft(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDraftRequestDto,
  ) {
    return this.experiences.updateDraft(principal, id, body);
  }

  @Post(':id/disable')
  @HttpCode(204)
  @Idempotent()
  @ApiNoContentResponse()
  async disable(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.lifecycle.disable(p, id, requestId(req));
  }

  @Post(':id/enable')
  @HttpCode(204)
  @Idempotent()
  @ApiNoContentResponse()
  async enable(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.lifecycle.enable(p, id, requestId(req));
  }

  @Post(':id/expire')
  @HttpCode(204)
  @Idempotent()
  @ApiNoContentResponse()
  async expire(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.lifecycle.expire(p, id, requestId(req));
  }

  @Put(':id/expiry')
  @HttpCode(204)
  @ApiNoContentResponse()
  async setExpiry(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetExpiryRequestDto,
    @Req() req: Request,
  ) {
    await this.lifecycle.setExpiry(
      p,
      id,
      body.expiresAt ? new Date(body.expiresAt) : null,
      requestId(req),
    );
  }

  /** Permanently deletes the experience and all recipient data. Idempotent. */
  @Delete(':id')
  @HttpCode(204)
  @Idempotent()
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.lifecycle.delete(p, id, requestId(req));
  }
}
