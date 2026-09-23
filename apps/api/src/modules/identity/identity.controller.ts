import { Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { requestId } from '../../common/request';
import { AccountDeletionService } from '../experiences/account-deletion.service';
import { CurrentPrincipal, Public } from './decorators';
import { MeResponseDto, OwnerTokenResponseDto } from './dto';
import { IdentityService } from './identity.service';
import type { Principal } from './principal';

@ApiTags('identity')
@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly accounts: AccountDeletionService,
  ) {}

  /**
   * Mints an anonymous owner identity. Public by necessity — it is what a first-time visitor
   * calls instead of registering. Rate limited because it writes a row.
   */
  @Post('owners')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: OwnerTokenResponseDto })
  async createOwner() {
    const { ownerToken } = await this.identity.mintOwner();
    return { ownerToken };
  }

  @Get('me')
  @ZodResponse({ status: 200, type: MeResponseDto })
  me(@CurrentPrincipal() principal: Principal) {
    return this.identity.me(principal);
  }

  /** Permanently deletes the creator's experiences, media and recipient data. */
  @Delete('me')
  @HttpCode(204)
  @ApiNoContentResponse()
  async deleteAccount(
    @CurrentPrincipal() principal: Principal,
    @Req() req: Request,
  ): Promise<void> {
    await this.accounts.deleteAccount(principal, requestId(req));
  }
}
