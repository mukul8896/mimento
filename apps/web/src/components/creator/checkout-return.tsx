'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Card, Spinner } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

type State = 'checking' | 'paid' | 'declined' | 'pending' | 'failed' | 'error';

/** UPI approvals and webhooks can lag the redirect by a few seconds, so keep asking briefly. */
const ATTEMPTS = 8;
const INTERVAL_MS = 3000;

export function CheckoutReturn({
  experienceId,
  orderId,
  paymentId,
}: {
  experienceId: string;
  orderId: string | null;
  paymentId: string | null;
}) {
  const [state, setState] = useState<State>(orderId ? 'checking' : 'error');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Providers may append the buyer's email; keep only what a refresh needs in the address bar.
    const kept = new URLSearchParams();
    if (orderId) kept.set('order', orderId);
    if (paymentId) kept.set('payment_id', paymentId);
    window.history.replaceState(null, '', `${window.location.pathname}?${kept.toString()}`);
    if (!orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check(attempt: number) {
      try {
        const res = unwrap(
          await browserApi().POST('/api/v1/experiences/{id}/checkout/{orderId}/confirm', {
            params: { path: { id: experienceId, orderId: orderId! } },
            body: paymentId ? { paymentId } : {},
          }),
        );
        if (cancelled) return;
        if (res.status === 'PAID') return setState('paid');
        if (res.status === 'FAILED' || res.status === 'EXPIRED') return setState('failed');
        if (res.attemptFailed) return setState('declined');
        if (attempt + 1 >= ATTEMPTS) return setState('pending');
        timer = setTimeout(() => void check(attempt + 1), INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : null);
        setState('error');
      }
    }
    void check(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [experienceId, orderId, paymentId]);

  const back = (
    <Link
      href={`/experiences/${experienceId}`}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white sm:w-auto"
    >
      Back to your surprise
    </Link>
  );

  return (
    <Card className="space-y-4" data-testid="checkout-return" data-state={state}>
      {state === 'checking' ? (
        <div className="flex items-center gap-3" role="status">
          <Spinner />
          <p>Checking your payment with the payment provider…</p>
        </div>
      ) : state === 'paid' ? (
        <>
          <Alert tone="success">Payment received — your surprise is unlocked.</Alert>
          <p className="text-sm text-ink-600">You can publish it and share the link now.</p>
          {back}
        </>
      ) : state === 'declined' ? (
        <>
          <Alert tone="warning">
            This payment did not go through, so nothing was charged and nothing was unlocked. You
            can try again with another card or payment method.
          </Alert>
          <Link
            href={`/experiences/${experienceId}#unlock`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white sm:w-auto"
          >
            Try again
          </Link>
        </>
      ) : state === 'pending' ? (
        <>
          <Alert tone="info">
            Your payment has not been confirmed yet. If you paid, it will unlock by itself within a
            few minutes — you do not need to pay again.
          </Alert>
          {back}
        </>
      ) : state === 'failed' ? (
        <>
          <Alert tone="warning">
            This payment did not go through, so nothing was unlocked. If money left your account, it
            will be refunded automatically by your bank or the provider.
          </Alert>
          {back}
        </>
      ) : (
        <>
          <Alert tone="danger">
            {message ?? 'We could not check this payment.'} If you paid, it will unlock by itself
            within a few minutes.
          </Alert>
          {back}
        </>
      )}
    </Card>
  );
}
