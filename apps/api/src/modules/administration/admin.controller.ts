import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import {
  AdminTemplateListResponseSchema,
  UpdateTemplateRequestSchema,
  AdminExperienceListResponseSchema,
  AdminListQuerySchema,
  AdminReportListResponseSchema,
  AuditLogListResponseSchema,
  GrantEntitlementRequestSchema,
  PublicExperienceSchema,
  ResolveReportRequestSchema,
  TakedownRequestSchema,
} from '@momentpath/contracts';
import { requestId } from '../../common/request';
import { AdminOnly, CurrentPrincipal } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { TemplatesService } from '../templates/templates.service';

class AdminListQueryDto extends createZodDto(AdminListQuerySchema) {}
class AdminReportListResponseDto extends createZodDto(AdminReportListResponseSchema) {}
class AdminExperienceListResponseDto extends createZodDto(AdminExperienceListResponseSchema) {}
class AuditLogListResponseDto extends createZodDto(AuditLogListResponseSchema) {}
class ResolveReportRequestDto extends createZodDto(ResolveReportRequestSchema) {}
class TakedownRequestDto extends createZodDto(TakedownRequestSchema) {}
class AdminContentDto extends createZodDto(PublicExperienceSchema) {}
class GrantEntitlementRequestDto extends createZodDto(GrantEntitlementRequestSchema) {}
class AdminTemplateListResponseDto extends createZodDto(AdminTemplateListResponseSchema) {}
class UpdateTemplateRequestDto extends createZodDto(UpdateTemplateRequestSchema) {}

@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
  ) {}

  @Get('templates')
  @ZodResponse({ status: 200, type: AdminTemplateListResponseDto })
  templateList() {
    return this.templates.adminList();
  }

  /** Free or paid (PLUS/PRO), shown or hidden. Existing surprises keep working either way. */
  @Put('templates/:key')
  @HttpCode(204)
  @ApiNoContentResponse()
  async updateTemplate(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Body() body: UpdateTemplateRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.templates.update(key, body);
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: principal.userId,
      action: 'template.updated',
      targetType: 'template',
      targetId: null,
      requestId: requestId(req),
      metadata: { key, tier: body.tier ?? null, isActive: body.isActive ?? null },
    });
  }

  /**
   * Unlocks a tier for one experience without a payment. This is how upgrades happen until the
   * payment provider is wired up, and stays useful afterwards for support and refunds.
   */
  @Post('experiences/:id/entitlement')
  @HttpCode(204)
  @ApiNoContentResponse()
  async grantEntitlement(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GrantEntitlementRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.moderation.grantEntitlement(principal, id, body, requestId(req));
  }

  @Get('reports')
  @ZodResponse({ status: 200, type: AdminReportListResponseDto })
  reports(@Query() query: AdminListQueryDto) {
    return this.moderation.reports(query);
  }

  @Post('reports/:id/resolve')
  @HttpCode(204)
  @ApiNoContentResponse()
  async resolve(
    @CurrentPrincipal() admin: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveReportRequestDto,
    @Req() req: Request,
  ) {
    await this.moderation.resolveReport(admin, id, body.resolution, body.note, requestId(req));
  }

  @Get('experiences')
  @ZodResponse({ status: 200, type: AdminExperienceListResponseDto })
  experiences(@Query() query: AdminListQueryDto) {
    return this.moderation.experiences(query);
  }

  @Get('experiences/:id/content')
  @ZodResponse({ status: 200, type: AdminContentDto })
  content(
    @CurrentPrincipal() admin: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.moderation.content(admin, id, requestId(req));
  }

  @Post('experiences/:id/takedown')
  @HttpCode(204)
  @ApiNoContentResponse()
  async takedown(
    @CurrentPrincipal() admin: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TakedownRequestDto,
    @Req() req: Request,
  ) {
    await this.moderation.setModeration(admin, id, true, body.reason, requestId(req));
  }

  @Post('experiences/:id/restore')
  @HttpCode(204)
  @ApiNoContentResponse()
  async restore(
    @CurrentPrincipal() admin: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.moderation.setModeration(admin, id, false, null, requestId(req));
  }

  @Get('audit-logs')
  @ZodResponse({ status: 200, type: AuditLogListResponseDto })
  auditLogs(@Query() query: AdminListQueryDto) {
    return this.moderation.auditLogs(query);
  }
}
