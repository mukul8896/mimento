import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { StartSessionRequestSchema } from '@momentpath/contracts';
import { Problem } from '../../common/problem';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import { Public } from '../identity/decorators';
import {
  AcceptedResponseDto,
  PublicExperienceMetaDto,
  ReportAbuseRequestDto,
  RevealGiftRequestDto,
  RevealGiftResponseDto,
  SessionStateResponseDto,
  ShortLinkSessionRequestDto,
  ShortLinkSessionResponseDto,
  StartSessionRequestDto,
  SubmitAnswerRequestDto,
  SubmitAnswerResponseDto,
} from './dto';
import { PrivateResponseInterceptor } from './private-response.interceptor';
import { RecipientSessionsService } from './recipient-sessions.service';

const SESSION_HEADER = 'x-recipient-session';
const sessionHeaderDoc = ApiHeader({
  name: SESSION_HEADER,
  required: true,
  description: 'Recipient session token',
});

/**
 * Recipient endpoints. No account is needed; the share token in the path authorises access to
 * one published experience and the session token (a header, never a URL) identifies progress.
 */
@ApiTags('public')
@Public()
@UseInterceptors(PrivateResponseInterceptor)
@Controller('public/experiences/:token')
export class PublicController {
  constructor(private readonly sessions: RecipientSessionsService) {}

  @Get('meta')
  @ZodResponse({ status: 200, type: PublicExperienceMetaDto })
  meta(@Param('token') token: string) {
    return this.sessions.meta(token);
  }

  @Post('sessions')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: SessionStateResponseDto })
  @ApiBody({ type: StartSessionRequestDto, required: false })
  start(@Param('token') token: string, @Body() body: unknown) {
    // The body is optional (only PIN-protected surprises need one), so it is parsed here.
    const parsed = StartSessionRequestSchema.safeParse(body ?? {});
    if (!parsed.success) throw Problem.badRequest('INVALID_PIN', 'Use 4 to 8 digits');
    return this.sessions.start(token, parsed.data.pin);
  }

  @Get('session')
  @sessionHeaderDoc
  @ZodResponse({ status: 200, type: SessionStateResponseDto })
  resume(@Param('token') token: string, @Headers(SESSION_HEADER) sessionToken?: string) {
    return this.sessions.resume(token, sessionToken);
  }

  @Post('session/answers')
  @sessionHeaderDoc
  @ZodResponse({ status: 200, type: SubmitAnswerResponseDto })
  answer(
    @Param('token') token: string,
    @Body() body: SubmitAnswerRequestDto,
    @Headers(SESSION_HEADER) sessionToken?: string,
  ) {
    return this.sessions.answer(token, sessionToken, body.stepKey, body.answer);
  }

  @Post('session/close')
  @HttpCode(204)
  @sessionHeaderDoc
  @ApiNoContentResponse()
  async close(
    @Param('token') token: string,
    @Headers(SESSION_HEADER) sessionToken?: string,
  ): Promise<void> {
    await this.sessions.close(token, sessionToken);
  }

  @Post('session/gift')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @sessionHeaderDoc
  @ZodResponse({ status: 200, type: RevealGiftResponseDto })
  reveal(
    @Param('token') token: string,
    @Body() body: RevealGiftRequestDto,
    @Headers(SESSION_HEADER) sessionToken?: string,
  ) {
    return this.sessions.revealGift(token, sessionToken, body.stepKey);
  }

  @Post('reports')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ZodResponse({ status: 202, type: AcceptedResponseDto })
  async report(@Param('token') token: string, @Body() body: ReportAbuseRequestDto) {
    await this.sessions.report(token, body.category, body.details);
    return { accepted: true as const };
  }
}

/**
 * Short links (/p/<slug>). They are readable and guessable, so they only work with the PIN, and
 * wrong names and wrong PINs look the same. The PIN lockout covers guesses from many IPs; this
 * throttle slows down a single one.
 */
@ApiTags('public')
@Public()
@UseInterceptors(PrivateResponseInterceptor)
@Controller('public/links/:slug')
export class ShortLinkController {
  constructor(private readonly sessions: RecipientSessionsService) {}

  @Post('sessions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: ShortLinkSessionResponseDto })
  start(@Param('slug') slug: string, @Body() body: ShortLinkSessionRequestDto) {
    return this.sessions.startByShortLink(slug.toLowerCase().slice(0, 40), body.pin);
  }
}
