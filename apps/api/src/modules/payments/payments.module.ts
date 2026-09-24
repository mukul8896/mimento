import { Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PAYMENT_GATEWAYS } from '../../providers/payments';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { createGateways } from './gateways';
import {
  CheckoutController,
  PaymentWebhooksController,
  PricingController,
} from './payments.controller';
import { PaymentsReconciler } from './payments.reconciler';
import { PaymentsService } from './payments.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [CheckoutController, PaymentWebhooksController, PricingController],
  providers: [
    {
      provide: PAYMENT_GATEWAYS,
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => createGateways(env),
    },
    PaymentsService,
    PaymentsReconciler,
  ],
  exports: [PaymentsReconciler],
})
export class PaymentsModule {}
