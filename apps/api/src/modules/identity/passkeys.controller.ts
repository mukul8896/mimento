import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import { requestId } from '../../common/request';
import { CurrentPrincipal, Public } from './decorators';
import {
  OwnerTokenResponseDto,
  PasskeyDto,
  PasskeyListResponseDto,
  PasskeyLoginRequestDto,
  PasskeyOptionsResponseDto,
  PasskeyRegisterRequestDto,
} from './dto';
import { PasskeysService } from './passkeys.service';
import { OWNER_TOKEN_HEADER, type Principal } from './principal';

@ApiTags('identity')
@Controller('passkeys')
export class PasskeysController {
  constructor(private readonly passkeys: PasskeysService) {}

  @Get()
  @ZodResponse({ status: 200, type: PasskeyListResponseDto })
  list(@CurrentPrincipal() principal: Principal) {
    return this.passkeys.list(principal);
  }

  @Post('registration-options')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: PasskeyOptionsResponseDto })
  registrationOptions(@CurrentPrincipal() principal: Principal) {
    return this.passkeys.registrationOptions(principal);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: PasskeyDto })
  register(
    @CurrentPrincipal() principal: Principal,
    @Body() body: PasskeyRegisterRequestDto,
    @Req() req: Request,
  ) {
    return this.passkeys.register(principal, body, requestId(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.passkeys.remove(principal, id, requestId(req));
  }

  /** Sign-in is public: the passkey itself is the proof. */
  @Post('login-options')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: PasskeyOptionsResponseDto })
  loginOptions() {
    return this.passkeys.loginOptions();
  }

  /**
   * Returns a new owner token for this device. Called by the web server, which puts it straight
   * into the HttpOnly cookie; the browser's script never sees it.
   */
  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ZodResponse({ status: 200, type: OwnerTokenResponseDto })
  login(
    @Body() body: PasskeyLoginRequestDto,
    @Headers(OWNER_TOKEN_HEADER) currentOwner: string | undefined,
    @Req() req: Request,
  ) {
    return this.passkeys.login(body, currentOwner, requestId(req));
  }
}
