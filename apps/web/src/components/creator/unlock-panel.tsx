'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Button, Card } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import {
  browserSignals,
  formatPrice,
  looksIndian,
  suggestedProvider,
  TIER_NAME,
  type Provider,
} from '@/lib/payments';

type Options = Schemas['CheckoutOptionsResponseDto_Output'];

const METHODS: Record<Provider, string> = {
  RAZORPAY: 'UPI, cards, net banking or wallets',
  DODO: 'Card, Apple Pay or Google Pay — local tax may be added',
};

/**
 * Shown on the manage page when a draft needs a paid tier. Payment happens on the provider's
 * own page; the API decides the price and confirms the payment with the provider afterwards.
 */
export function UnlockPanel({ experienceId }: { experienceId: string }) {
  const api = browserApi();
  const [options, setOptions] = useState<Options | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = unwrap(
          await api.GET('/api/v1/experiences/{id}/checkout', {
            params: { path: { id: experienceId } },
          }),
        );
        if (cancelled) return;
        setOptions(res);
        setProvider(suggestedProvider(res.offers, looksIndian(browserSignals())));
      } catch {
        if (!cancelled) setError('Prices could not be loaded. Refresh to try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, experienceId]);

  if (error && !options) return <Alert tone="danger">{error}</Alert>;
  if (!options || !options.billingEnabled || options.tier.satisfied) return null;

  const offer = options.offers.find((o) => o.provider === provider);
  const other = options.offers.find((o) => o.provider !== provider);

  async function pay() {
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      const res = unwrap(
        await api.POST('/api/v1/experiences/{id}/checkout', {
          params: { path: { id: experienceId } },
          body: { provider: offer.provider },
        }),
      );
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : 'Something went wrong.',
      );
      setBusy(false);
    }
  }

  return (
    <Card id="unlock" data-testid="unlock-panel">
      <h2 className="font-semibold">Unlock {TIER_NAME[options.tier.required]}</h2>
      {offer ? (
        <div className="mt-3 space-y-3">
          <p className="text-3xl font-semibold" data-testid="unlock-price">
            {formatPrice(offer.amountMinor, offer.currency)}
            <span className="ml-2 text-sm font-normal text-ink-500">
              one-time, for this surprise
            </span>
          </p>
          <p className="text-sm text-ink-600">{METHODS[offer.provider]}</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button busy={busy} onClick={pay} className="w-full sm:w-auto" data-testid="unlock-pay">
            Pay {formatPrice(offer.amountMinor, offer.currency)}
          </Button>
          {other ? (
            <p className="text-sm">
              <button
                type="button"
                className="text-brand-700 underline"
                onClick={() => setProvider(other.provider)}
              >
                {other.provider === 'DODO'
                  ? 'Paying from outside India? Pay in US dollars'
                  : 'Paying from India? Use UPI and pay in rupees'}
              </button>
            </p>
          ) : null}
          <p className="text-xs text-ink-500">
            You pay on {offer.provider === 'RAZORPAY' ? 'Razorpay' : 'Dodo Payments'}&apos;s secure
            page and come straight back here. We never see your card or UPI details.{' '}
            <Link href="/refunds" className="underline">
              Refunds
            </Link>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-600">
          Payments are not available right now. Everything you have written is saved — try again
          later.
        </p>
      )}
    </Card>
  );
}
