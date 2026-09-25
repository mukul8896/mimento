import Link from 'next/link';
import { publicServerApi } from '@/lib/api/server';
import { formatPrice } from '@/lib/payments';
import { SiteShell } from '@/components/site/site-shell';
import { PlusProCompare } from '@/components/creator/plus-pro';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pricing' };

const PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    blurb: 'A free template to try it: change the words, photos and music right in its preview.',
  },
  {
    tier: 'PLUS',
    name: 'PLUS',
    blurb:
      'Personalise any ready-made template: the words, photos, button labels, music and your gift. One price for every template.',
  },
  {
    tier: 'PRO',
    name: 'PRO',
    blurb:
      'Change the experience itself: add, remove and reorder steps, change the flow, or create from scratch.',
  },
] as const;

export default async function PricingPage() {
  const { data } = await publicServerApi().GET('/api/v1/pricing');
  const price = (tier: 'PLUS' | 'PRO') => data?.plans.find((p) => p.tier === tier);

  return (
    <SiteShell title="Pricing">
      <p>
        Pay once per surprise, only when you share it. Building, previewing and saving are always
        free, and there is no subscription.
      </p>
      {data && !data.billingEnabled ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Every plan is free while we are getting started.
        </p>
      ) : null}
      <div className="grid gap-4 pt-2 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const p = plan.tier === 'FREE' ? null : price(plan.tier);
          const amounts = p
            ? [
                p.inrMinor !== null ? formatPrice(p.inrMinor, 'INR') : null,
                p.usdMinor !== null ? formatPrice(p.usdMinor, 'USD') : null,
              ].filter(Boolean)
            : [];
          return (
            <article
              key={plan.tier}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-100"
            >
              <h2 className="font-semibold text-ink-900">{plan.name}</h2>
              <p className="mt-2 text-2xl font-semibold" data-testid={`price-${plan.tier}`}>
                {plan.tier === 'FREE' ? 'Free' : amounts.length ? amounts.join(' / ') : '—'}
              </p>
              <p className="mt-2 text-sm text-ink-600">{plan.blurb}</p>
            </article>
          );
        })}
      </div>
      <p className="text-sm text-ink-600">
        Prices in rupees are paid through Razorpay (UPI, cards, net banking, wallets). Prices in US
        dollars are paid through Dodo Payments, which is the seller for customers outside India and
        may add local sales tax at checkout. Moving a surprise from PLUS to PRO costs the
        difference. See our{' '}
        <Link href="/refunds" className="underline">
          refund policy
        </Link>
        .
      </p>
      <PlusProCompare className="mt-2" />
    </SiteShell>
  );
}
