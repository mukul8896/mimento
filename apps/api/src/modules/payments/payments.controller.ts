import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { Request } from 'express';
import {
  CheckoutOptionsResponseSchema,
  CheckoutResponseSchema,
  ConfirmCheckoutRequestSchema,
  ConfirmCheckoutResponseSchema,
  CreateCheckoutRequestSchema,
  PricingResponseSchema,
} from '@momentpath/contracts';
import { Problem } from '../../common/problem';
import { requestId } from '../../common/request';
import { WebhookSignatureError, type WebhookHeaders } from '../../providers/payments';
import { CurrentPrincipal, Public } from '../identity/decorators';
import type { Principal } from '../identity/principal';
import { PaymentsService } from './payments.service';

class CheckoutOptionsResponseDto extends createZodDto(CheckoutOptionsResponseSchema) {}
class CreateCheckoutRequestDto extends createZodDto(CreateCheckoutRequestSchema) {}
class CheckoutResponseDto extends createZodDto(CheckoutResponseSchema) {}
class ConfirmCheckoutRequestDto extends createZodDto(ConfirmCheckoutRequestSchema) {}
class ConfirmCheckoutResponseDto extends createZodDto(ConfirmCheckoutResponseSchema) {}
class PricingResponseDto extends createZodDto(PricingResponseSchema) {}

@ApiTags('payments')
@Public()
@Controller('pricing')
export class PricingController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ZodResponse({ status: 200, type: PricingResponseDto })
  pricing() {
    return this.payments.pricing();
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('experiences/:id/checkout')
export class CheckoutController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Header('cache-control', 'no-store')
  @ZodResponse({ status: 200, type: CheckoutOptionsResponseDto })
  options(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.options(p, id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: CheckoutResponseDto })
  create(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCheckoutRequestDto,
    @Req() req: Request,
  ) {
    return this.payments.createCheckout(
      p,
      id,
      body.provider,
      requestId(req),
      body.publish ?? false,
    );
  }

  @Post(':orderId/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ZodResponse({ status: 200, type: ConfirmCheckoutResponseDto })
  confirm(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: ConfirmCheckoutRequestDto,
  ) {
    return this.payments.confirm(p, id, orderId, body.paymentId ?? null);
  }
}

/**
 * Provider webhooks. Public by necessity, so the signature is the only credential: anything
 * unsigned or mis-signed is refused before the body is read. Not throttled, because providers
 * retry from a few shared IPs and a dropped delivery is a missed payment.
 */
@Public()
@SkipThrottle()
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async receive(
    @Param('provider', new ParseEnumPipe(['razorpay', 'dodo'])) provider: 'razorpay' | 'dodo',
    @Req() req: Request,
  ): Promise<{ received: true }> {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) throw Problem.badRequest('INVALID_BODY', 'Expected a raw body');
    const headers: WebhookHeaders = {};
    for (const [name, value] of Object.entries(req.headers)) {
      headers[name] = Array.isArray(value) ? value[0] : value;
    }
    try {
      await this.payments.handleWebhook(
        provider === 'razorpay' ? 'RAZORPAY' : 'DODO',
        raw,
        headers,
      );
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        throw new Problem(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
      }
      throw err;
    }
    return { received: true };
  }
}
