import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  highestTier,
  type ExperienceMode,
  type PaymentProvider,
  type Tier,
} from '@momentpath/contracts';
import { requireOwnedExperience } from '../../common/ownership';
import { Problem } from '../../common/problem';
import { APP_ENV, type AppEnv } from '../../config/env';
import type { PaymentOrder } from '../../generated/prisma/client';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import {
  PAYMENT_GATEWAYS,
  ProviderUnavailableError,
  type PaymentGateway,
  type PaymentGateways,
  type PaymentLookup,
  type WebhookHeaders,
} from '../../providers/payments';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PublishingService } from '../publishing/publishing.service';
import { toDraftSteps } from '../experiences/step-mapping';
import type { Principal } from '../identity/principal';
import { offersFor, priceBook } from './pricing';

/** A checkout the creator abandoned is reused for this long instead of opening another. */
const REUSE_WINDOW_MS = 20 * 60 * 1000;
/** Orders still unpaid after this are closed by the reconciler. */
export const ORDER_LIFETIME_MS = 24 * 3600 * 1000;

const TIER_LABEL: Record<Tier, string> = { FREE: 'Free', PLUS: 'Plus', PRO: 'Pro' };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly publishing: PublishingService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateways,
  ) {}

  private async tierState(experience: {
    id: string;
    templateKey: string | null;
    mode: ExperienceMode;
  }) {
    const draft = await this.prisma.experienceVersion.findFirst({
      where: { experienceId: experience.id, state: 'DRAFT' },
      include: { steps: true },
    });
    if (!draft) throw Problem.notFound('Draft');
    return this.entitlements.tierState(experience, toDraftSteps(draft.steps));
  }

  private offers(state: { required: Tier; held: Tier }) {
    if (!this.env.BILLING_ENABLED) return [];
    return offersFor(state, priceBook(this.env), {
      razorpay: !!this.gateways.RAZORPAY,
      dodo: !!this.gateways.DODO,
    });
  }

  /** Public price list for the pricing page, from the same configuration checkout uses. */
  pricing() {
    const book = priceBook(this.env);
    const tiers = ['PLUS', 'PRO'] as const;
    return {
      billingEnabled: this.env.BILLING_ENABLED,
      plans: tiers.map((tier) => ({
        tier,
        inrMinor: this.gateways.RAZORPAY ? book.inr[tier] : null,
        usdMinor: this.gateways.DODO && book.dodoProducts[tier] ? book.usd[tier] : null,
      })),
    };
  }

  async options(principal: Principal, experienceId: string) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const tier = await this.tierState(exp);
    return {
      billingEnabled: this.env.BILLING_ENABLED,
      tier,
      offers: this.offers(tier).map((o) => ({
        provider: o.provider,
        tier: o.tier,
        amountMinor: o.amountMinor,
        currency: o.currency,
      })),
    };
  }

  /**
   * Opens a hosted checkout for the tier this draft needs. The price is decided here, never by
   * the browser. A recent unpaid checkout for the same purchase is reused, which also keeps us
   * inside Razorpay's small test-mode allowance of payment links.
   */
  async createCheckout(
    principal: Principal,
    experienceId: string,
    provider: PaymentProvider,
    requestId: string | null,
    publish = false,
  ) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    if (!this.env.BILLING_ENABLED) {
      throw Problem.conflict('BILLING_DISABLED', 'Everything is free right now');
    }
    const tier = await this.tierState(exp);
    const offer = this.offers(tier).find((o) => o.provider === provider);
    const gateway = this.gateways[provider];
    if (!offer || !gateway) {
      throw tier.satisfied
        ? Problem.conflict('ALREADY_UNLOCKED', 'This surprise is already unlocked')
        : Problem.unprocessable('PROVIDER_UNAVAILABLE', 'This payment method is not available');
    }

    const recent = await this.prisma.paymentOrder.findFirst({
      where: {
        experienceId,
        provider,
        tier: offer.tier,
        amountMinor: offer.amountMinor,
        status: 'CREATED',
        createdAt: { gt: new Date(Date.now() - REUSE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      if (publish && !recent.publishOnPaid) {
        await this.prisma.paymentOrder.update({
          where: { id: recent.id },
          data: { publishOnPaid: true },
        });
      }
      return { orderId: recent.id, checkoutUrl: recent.checkoutUrl };
    }

    const orderId = crypto.randomUUID();
    const returnUrl = new URL(`/experiences/${experienceId}/checkout`, this.env.WEB_ORIGIN);
    returnUrl.searchParams.set('order', orderId);

    let checkout: { providerOrderId: string; checkoutUrl: string };
    try {
      checkout = await gateway.createCheckout({
        orderId,
        amountMinor: offer.amountMinor,
        currency: offer.currency,
        productId: offer.productId,
        description: `${TIER_LABEL[offer.tier]} surprise`,
        returnUrl: returnUrl.toString(),
      });
    } catch (err) {
      throw this.unavailable(err);
    }

    await this.prisma.paymentOrder.create({
      data: {
        id: orderId,
        experienceId,
        tier: offer.tier,
        provider,
        amountMinor: offer.amountMinor,
        currency: offer.currency,
        providerOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
        publishOnPaid: publish,
        createdById: principal.userId,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: principal.userId,
      action: 'payment.checkout_created',
      targetType: 'experience',
      targetId: experienceId,
      requestId,
      metadata: { orderId, provider, tier: offer.tier, publish },
    });
    return { orderId, checkoutUrl: checkout.checkoutUrl };
  }

  /**
   * Called when the creator returns from the provider. The browser's word is never taken: the
   * API asks the provider itself, so a forged return URL unlocks nothing.
   */
  async confirm(
    principal: Principal,
    experienceId: string,
    orderId: string,
    paymentId: string | null,
  ) {
    const exp = await requireOwnedExperience(this.prisma, principal, experienceId);
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id: orderId, experienceId: exp.id },
    });
    if (!order) throw Problem.notFound('Order');

    let status = order.status;
    let attemptFailed = false;
    if (status !== 'PAID') {
      const gateway = this.gateways[order.provider];
      if (!gateway) throw Problem.unprocessable('PROVIDER_UNAVAILABLE', 'Payment method removed');
      let result: PaymentLookup;
      try {
        result = await gateway.lookup({
          providerOrderId: order.providerOrderId,
          paymentId: paymentId ?? order.providerPaymentId,
        });
      } catch (err) {
        throw this.unavailable(err);
      }
      attemptFailed = result.state === 'PENDING' && result.attemptFailed === true;
      status = await this.apply(order, gateway, result, null);
    }
    if (status === 'PAID') await this.publishIfRequested(order.id);
    const [paid, now] = await Promise.all([
      this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } }),
      this.prisma.experience.findUniqueOrThrow({ where: { id: exp.id } }),
    ]);
    const published =
      paid.paidAt !== null && now.publishedAt !== null && now.publishedAt >= paid.paidAt;
    return {
      orderId: order.id,
      status,
      attemptFailed,
      tier: await this.tierState(now),
      published,
    };
  }

  /**
   * Publish → Payment → Published. A checkout started from Publish publishes the experience once
   * it is paid, whichever path confirms the payment first (return page, webhook, reconciler).
   * Clearing the flag is the claim, so the experience is published once, not once per path.
   * If publishing fails (say a photo is still being scanned) the payment still stands and the
   * creator publishes with one tap; nothing is lost.
   */
  async publishIfRequested(orderId: string): Promise<void> {
    const claimed = await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: 'PAID', publishOnPaid: true, experienceId: { not: null } },
      data: { publishOnPaid: false },
    });
    if (claimed.count === 0) return;
    const order = await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
    const exp = await this.prisma.experience.findFirst({
      where: { id: order.experienceId!, status: { not: 'DELETED' } },
    });
    if (!exp) return;
    try {
      // Published on the owner's behalf: they asked for it when they pressed Publish.
      await this.publishing.publish(
        { userId: exp.ownerId, subject: 'payment', isAdmin: false },
        exp.id,
        null,
      );
    } catch (err) {
      const code = err instanceof Problem ? err.code : 'UNEXPECTED';
      this.logger.warn({ orderId, code }, 'Paid, but publishing after payment failed');
    }
  }

  /**
   * Webhook entry point. The delivery id is recorded in the same transaction as its effect, so a
   * retry after success is acknowledged without work, and a failure rolls back and is retried.
   */
  async handleWebhook(provider: PaymentProvider, rawBody: Buffer, headers: WebhookHeaders) {
    const gateway = this.gateways[provider];
    if (!gateway) throw Problem.notFound('Webhook');
    const event = gateway.parseWebhook(rawBody, headers);
    if (!event) return;

    let paidOrderId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      // ON CONFLICT DO NOTHING: a concurrent duplicate waits for the first, then does nothing.
      const recorded = await tx.paymentWebhookEvent.createMany({
        data: [{ provider, eventId: event.eventId, type: event.type }],
        skipDuplicates: true,
      });
      if (recorded.count === 0) return;
      const order = await this.findOrder(tx, provider, event.orderReference, event.providerOrderId);
      if (!order) {
        this.logger.warn({ provider, type: event.type }, 'Webhook for an unknown order');
        return;
      }
      paidOrderId =
        (await this.apply(order, gateway, event.result, tx)) === 'PAID' ? order.id : null;
    });
    if (paidOrderId) await this.publishIfRequested(paidOrderId);
  }

  private async findOrder(
    tx: Tx,
    provider: PaymentProvider,
    orderReference: string | null,
    providerOrderId: string | null,
  ) {
    if (orderReference && /^[0-9a-f-]{36}$/i.test(orderReference)) {
      const byRef = await tx.paymentOrder.findFirst({ where: { id: orderReference, provider } });
      if (byRef) return byRef;
    }
    if (providerOrderId) {
      return tx.paymentOrder.findUnique({
        where: { provider_providerOrderId: { provider, providerOrderId } },
      });
    }
    return null;
  }

  /**
   * Moves an order forward from a provider result and returns its new status. Only a paid
   * result grants anything, and only once: the conditional update is the guard, so concurrent
   * webhook and return-page confirmations cannot both grant.
   */
  async apply(
    order: PaymentOrder,
    gateway: PaymentGateway,
    result: PaymentLookup,
    tx: Tx | null,
  ): Promise<PaymentOrder['status']> {
    if (!tx) return this.prisma.$transaction((t) => this.apply(order, gateway, result, t));
    if (order.status === 'PAID') return 'PAID';

    if (result.state === 'PENDING') return order.status;
    if (result.state === 'CLOSED') {
      await tx.paymentOrder.updateMany({
        where: { id: order.id, status: 'CREATED' },
        data: { status: 'EXPIRED' },
      });
      return order.status === 'CREATED' ? 'EXPIRED' : order.status;
    }

    const linked =
      result.orderReference === order.id ||
      (result.providerOrderId !== null && result.providerOrderId === order.providerOrderId);
    const amountOk =
      !gateway.exactAmount ||
      (result.amountMinor === order.amountMinor &&
        result.currency?.toUpperCase() === order.currency);
    if (!linked || !amountOk) {
      await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { not: 'PAID' } },
        data: { status: 'FAILED' },
      });
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: null,
          action: 'payment.rejected',
          targetType: 'experience',
          targetId: order.experienceId,
          requestId: null,
          metadata: { orderId: order.id, provider: order.provider, linked, amountOk },
        },
        tx,
      );
      this.logger.warn({ orderId: order.id, linked, amountOk }, 'Payment did not match its order');
      return 'FAILED';
    }

    // A late payment on an expired order still counts: the customer's money arrived.
    const won = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { not: 'PAID' } },
      data: { status: 'PAID', providerPaymentId: result.paymentId, paidAt: new Date() },
    });
    if (won.count === 0) return 'PAID';

    if (order.experienceId) {
      const existing = await tx.entitlement.findUnique({
        where: { experienceId: order.experienceId },
      });
      const tier = highestTier(existing?.tier ?? 'FREE', order.tier);
      const providerRef = `${order.provider}:${result.paymentId}`;
      await tx.entitlement.upsert({
        where: { experienceId: order.experienceId },
        create: {
          experienceId: order.experienceId,
          tier,
          source: 'PURCHASE',
          providerRef,
          note: `Order ${order.id}`,
        },
        update: { tier, source: 'PURCHASE', providerRef, note: `Order ${order.id}` },
      });
    }
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        actorId: null,
        action: 'payment.succeeded',
        targetType: 'experience',
        targetId: order.experienceId,
        requestId: null,
        metadata: {
          orderId: order.id,
          provider: order.provider,
          tier: order.tier,
          amountMinor: order.amountMinor,
          currency: order.currency,
        },
      },
      tx,
    );
    return 'PAID';
  }

  private unavailable(err: unknown): Problem {
    if (err instanceof ProviderUnavailableError) {
      this.logger.warn({ reason: err.message }, 'Payment provider call failed');
      return new Problem(
        502,
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'The payment service did not respond. Please try again.',
      );
    }
    throw err;
  }
}
