import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PaymentsReconciler } from '../src/modules/payments/payments.reconciler';
import {
  DODO_API_KEY,
  DODO_WEBHOOK_SECRET,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  startFakeProviders,
  type FakeProviders,
} from './fake-payment-providers';
import { API, createTestContext, creator, type Creator, type TestContext } from './helpers';

let ctx: TestContext;
let fake: FakeProviders;
let alice: Creator;
let mallory: Creator;

beforeAll(async () => {
  fake = await startFakeProviders();
  ctx = await createTestContext({
    BILLING_ENABLED: 'true',
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    RAZORPAY_API_BASE: fake.base,
    DODO_API_KEY,
    DODO_WEBHOOK_SECRET,
    DODO_API_BASE: fake.base,
    DODO_PRODUCT_PLUS: 'pdt_plus',
    DODO_PRODUCT_PRO: 'pdt_pro',
    PAYMENTS_RECONCILE_MS: '0',
  });
  alice = await creator(ctx);
  mallory = await creator(ctx);
});
afterAll(async () => {
  await ctx.close();
  await fake.close();
});
beforeEach(() => fake.setDown(false));

/** A PLUS template: publishing is blocked until it is paid for. */
async function paidDraft() {
  const created = await alice.post('/experiences', { templateKey: 'birthday-surprise' });
  expect(created.status).toBe(201);
  return created.body.id as string;
}

const tierOf = async (id: string) => (await alice.get(`/experiences/${id}`)).body.tier;

function webhook(provider: string, signed: { body: Buffer; headers: Record<string, string> }) {
  return (
    ctx.http
      .post(`${API}/payments/webhooks/${provider}`)
      .set('content-type', 'application/json')
      .set(signed.headers)
      // A string, not the Buffer: superagent would JSON-encode a Buffer and break the signature.
      .send(signed.body.toString('utf8'))
  );
}

describe('pricing', () => {
  it('publishes the configured price list without authentication', async () => {
    const res = await ctx.http.get(`${API}/pricing`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      billingEnabled: true,
      plans: [
        { tier: 'PLUS', inrMinor: 9900, usdMinor: 299 },
        { tier: 'PRO', inrMinor: 19900, usdMinor: 499 },
      ],
    });
  });
});

describe('checkout options', () => {
  it('prices the required tier with both providers', async () => {
    const id = await paidDraft();
    const res = await alice.get(`/experiences/${id}/checkout`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      billingEnabled: true,
      tier: { required: 'PLUS', held: 'FREE', satisfied: false },
      offers: [
        { provider: 'RAZORPAY', tier: 'PLUS', amountMinor: 9900, currency: 'INR' },
        { provider: 'DODO', tier: 'PLUS', amountMinor: 299, currency: 'USD' },
      ],
    });
  });

  it('offers nothing for a free template', async () => {
    const created = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const res = await alice.get(`/experiences/${created.body.id}/checkout`);
    expect(res.body.offers).toEqual([]);
    const buy = await alice.post(`/experiences/${created.body.id}/checkout`, {
      provider: 'RAZORPAY',
    });
    expect(buy.status).toBe(409);
    expect(buy.body.code).toBe('ALREADY_UNLOCKED');
  });
});

describe('Razorpay', () => {
  it('unlocks and publishes after the creator returns from a paid link', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    expect(checkout.status).toBe(201);
    expect(checkout.body.checkoutUrl).toMatch(/^https:\/\/rzp\.example\/i\/plink_/);
    const link = [...fake.links.values()].find((l) => l.reference_id === checkout.body.orderId)!;
    expect(link).toMatchObject({ amount: 9900, currency: 'INR' });

    // Coming back before paying changes nothing.
    const early = await alice.post(
      `/experiences/${id}/checkout/${checkout.body.orderId}/confirm`,
      {},
    );
    expect(early.body.status).toBe('CREATED');
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(422);

    fake.payLink(link.id);
    const confirmed = await alice.post(
      `/experiences/${id}/checkout/${checkout.body.orderId}/confirm`,
      {},
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({
      status: 'PAID',
      tier: { required: 'PLUS', held: 'PLUS', satisfied: true },
    });
    expect((await alice.post(`/experiences/${id}/publish`)).status).toBe(200);

    const audit = await ctx.prisma.auditLog.findMany({
      where: { targetId: id, action: 'payment.succeeded' },
    });
    expect(audit).toHaveLength(1);
  });

  it('reuses an unpaid checkout instead of opening another link', async () => {
    const id = await paidDraft();
    const first = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    const second = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    expect(second.body).toEqual(first.body);
  });

  it('grants from a signed webhook exactly once, even when it is replayed', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    const link = fake.payLink(
      [...fake.links.values()].find((l) => l.reference_id === checkout.body.orderId)!.id,
    );
    const delivery = fake.razorpayWebhook('payment_link.paid', link, `evt_${link.id}`);

    expect((await webhook('razorpay', delivery)).status).toBe(200);
    expect((await webhook('razorpay', delivery)).status).toBe(200);
    expect(await tierOf(id)).toMatchObject({ held: 'PLUS', satisfied: true });
    const audit = await ctx.prisma.auditLog.count({
      where: { targetId: id, action: 'payment.succeeded' },
    });
    expect(audit).toBe(1);
  });

  it('refuses unsigned and mis-signed webhooks', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    const link = fake.payLink(
      [...fake.links.values()].find((l) => l.reference_id === checkout.body.orderId)!.id,
    );
    const delivery = fake.razorpayWebhook('payment_link.paid', link, `evt_forged_${link.id}`);

    const forged = {
      ...delivery,
      headers: { ...delivery.headers, 'x-razorpay-signature': 'ab'.repeat(32) },
    };
    expect((await webhook('razorpay', forged)).status).toBe(401);
    const unsigned = { body: delivery.body, headers: {} };
    expect((await webhook('razorpay', unsigned)).status).toBe(401);
    expect(await tierOf(id)).toMatchObject({ held: 'FREE' });
  });

  it('does not unlock when the provider reports a different amount', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    const link = [...fake.links.values()].find((l) => l.reference_id === checkout.body.orderId)!;
    fake.payLink(link.id, 100);
    const res = await alice.post(
      `/experiences/${id}/checkout/${checkout.body.orderId}/confirm`,
      {},
    );
    expect(res.body.status).toBe('FAILED');
    expect(res.body.tier).toMatchObject({ held: 'FREE', satisfied: false });
  });

  it('is caught by the reconciler when neither the webhook nor the creator comes back', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    fake.payLink(
      [...fake.links.values()].find((l) => l.reference_id === checkout.body.orderId)!.id,
    );

    const reconciler = ctx.app.get(PaymentsReconciler);
    await reconciler.reconcile(); // too recent: the buyer may still be on the page
    expect(await tierOf(id)).toMatchObject({ held: 'FREE' });
    await reconciler.reconcile(new Date(Date.now() + 3 * 60 * 1000));
    expect(await tierOf(id)).toMatchObject({ held: 'PLUS', satisfied: true });
  });

  it('reports an unavailable provider without creating an order', async () => {
    const id = await paidDraft();
    fake.setDown(true);
    const res = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(await ctx.prisma.paymentOrder.count({ where: { experienceId: id } })).toBe(0);
  });
});

describe('Dodo', () => {
  it('unlocks with the payment id from the return URL, allowing for added tax', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'DODO' });
    expect(checkout.status).toBe(201);
    const sessionId = checkout.body.checkoutUrl.split('/').pop();
    const payment = fake.payDodo(sessionId);

    const res = await alice.post(`/experiences/${id}/checkout/${checkout.body.orderId}/confirm`, {
      paymentId: payment.payment_id,
    });
    expect(res.body).toMatchObject({ status: 'PAID', tier: { held: 'PLUS', satisfied: true } });
  });

  it('will not accept a payment made for a different checkout', async () => {
    const other = await paidDraft();
    const otherCheckout = await alice.post(`/experiences/${other}/checkout`, { provider: 'DODO' });
    const otherPayment = fake.payDodo(otherCheckout.body.checkoutUrl.split('/').pop());

    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'DODO' });
    const res = await alice.post(`/experiences/${id}/checkout/${checkout.body.orderId}/confirm`, {
      paymentId: otherPayment.payment_id,
    });
    expect(res.body.status).toBe('FAILED');
    expect(await tierOf(id)).toMatchObject({ held: 'FREE' });
  });

  it('grants from a Standard Webhooks delivery and rejects a stale one', async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'DODO' });
    const payment = fake.payDodo(checkout.body.checkoutUrl.split('/').pop());

    const stale = fake.dodoWebhook(
      'payment.succeeded',
      payment,
      'msg_stale',
      Math.floor(Date.now() / 1000) - 600,
    );
    expect((await webhook('dodo', stale)).status).toBe(401);
    expect(await tierOf(id)).toMatchObject({ held: 'FREE' });

    const fresh = fake.dodoWebhook('payment.succeeded', payment, `msg_${payment.payment_id}`);
    expect((await webhook('dodo', fresh)).status).toBe(200);
    expect(await tierOf(id)).toMatchObject({ held: 'PLUS', satisfied: true });
  });
});

describe('access', () => {
  it("hides one creator's checkout from another", async () => {
    const id = await paidDraft();
    const checkout = await alice.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' });
    expect((await mallory.get(`/experiences/${id}/checkout`)).status).toBe(404);
    expect(
      (await mallory.post(`/experiences/${id}/checkout`, { provider: 'RAZORPAY' })).status,
    ).toBe(404);
    expect(
      (await mallory.post(`/experiences/${id}/checkout/${checkout.body.orderId}/confirm`, {}))
        .status,
    ).toBe(404);
  });

  it('refuses checkout while billing is off', async () => {
    const free = await createTestContext({
      RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET,
      RAZORPAY_API_BASE: fake.base,
    });
    try {
      const user = await creator(free);
      const created = await user.post('/experiences', { templateKey: 'birthday-surprise' });
      const res = await user.post(`/experiences/${created.body.id}/checkout`, {
        provider: 'RAZORPAY',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('BILLING_DISABLED');
    } finally {
      await free.close();
    }
  });
});
