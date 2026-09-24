import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_GATEWAYS, type PaymentGateways } from '../../providers/payments';
import { ORDER_LIFETIME_MS, PaymentsService } from './payments.service';

/** Checkouts younger than this are left alone: the customer may still be on the provider page. */
const SETTLE_MS = 2 * 60 * 1000;
const BATCH = 25;

/**
 * Catches payments whose webhook never arrived and whose buyer never came back (closed tab,
 * delayed UPI approval). Unpaid orders are asked about until they are a day old, then closed.
 * Runs in-process like the outbox; the Phase 2 worker can take it over unchanged.
 */
@Injectable()
export class PaymentsReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('PaymentsReconciler');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateways,
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.PAYMENTS_RECONCILE_MS > 0 && this.env.PROCESS_ROLE !== 'api') {
      this.timer = setInterval(() => void this.tick(), this.env.PAYMENTS_RECONCILE_MS);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcile();
    } catch (err) {
      this.logger.error({ err: { message: (err as Error).message } }, 'Reconcile failed');
    } finally {
      this.running = false;
    }
  }

  /** One pass. Public so tests and operators can run it on demand. */
  async reconcile(now = new Date()): Promise<{ checked: number; paid: number; expired: number }> {
    const stats = { checked: 0, paid: 0, expired: 0 };
    const expiredBefore = new Date(now.getTime() - ORDER_LIFETIME_MS);
    stats.expired = (
      await this.prisma.paymentOrder.updateMany({
        where: { status: 'CREATED', createdAt: { lt: expiredBefore } },
        data: { status: 'EXPIRED' },
      })
    ).count;

    const due = await this.prisma.paymentOrder.findMany({
      where: { status: 'CREATED', createdAt: { lt: new Date(now.getTime() - SETTLE_MS) } },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
    });
    for (const order of due) {
      const gateway = this.gateways[order.provider];
      if (!gateway) continue;
      stats.checked += 1;
      try {
        const result = await gateway.lookup({
          providerOrderId: order.providerOrderId,
          paymentId: order.providerPaymentId,
        });
        const status = await this.payments.apply(order, gateway, result, null);
        if (status === 'PAID') stats.paid += 1;
        // Rotate through the queue instead of re-asking about the same orders first.
        await this.prisma.paymentOrder.updateMany({
          where: { id: order.id, status: 'CREATED' },
          data: { updatedAt: now },
        });
      } catch (err) {
        this.logger.warn({ orderId: order.id, reason: (err as Error).message }, 'Lookup failed');
      }
    }
    return stats;
  }
}
