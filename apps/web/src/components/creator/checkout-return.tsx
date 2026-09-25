'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Spinner } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

type State =
  'checking' | 'live' | 'paid' | 'publishing' | 'declined' | 'pending' | 'failed' | 'error';

/** UPI approvals and webhooks can lag the redirect by a few seconds, so keep asking briefly. */
const ATTEMPTS = 8;
const INTERVAL_MS = 3000;

/**
 * Where the creator lands after the payment page. Publish → Payment → Published: a checkout
 * started from Publish is live by the time this confirms. Whatever happened, the surprise is
 * safe, and every state has one obvious next step.
 */
export function CheckoutReturn({
  experienceId,
  orderId,
  paymentId,
  returnTo,
}: {
  experienceId: string;
  orderId: string | null;
  paymentId: string | null;
  /** The page the creator was working on: Personalize for templates, the builder for PRO. */
  returnTo: string;
}) {
  const [state, setState] = useState<State>(orderId ? 'checking' : 'error');
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

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
        if (res.status === 'PAID') {
          if (res.published) {
            setState('live');
            // Published: the recipient and private management links have their own page.
            return router.replace(`/experiences/${experienceId}/published`);
          }
          return setState('paid');
        }
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
  }, [experienceId, orderId, paymentId, router]);

  // Paid, but publishing afterwards was blocked (say a photo was still being scanned).
  async function publishNow() {
    setState('publishing');
    try {
      unwrap(
        await browserApi().POST('/api/v1/experiences/{id}/publish', {
          params: {
            path: { id: experienceId },
            header: { 'Idempotency-Key': crypto.randomUUID() },
          },
        }),
      );
      setState('live');
      router.replace(`/experiences/${experienceId}/published`);
    } catch (err) {
      setMessage(
        err instanceof ApiError
          ? (err.problem.issues?.[0]?.message ?? err.problem.detail ?? err.problem.title)
          : null,
      );
      setState('paid');
    }
  }

  const button =
    'inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-semibold sm:w-auto';
  const back = (label = 'Back to my surprise') => (
    <Link href={returnTo} className={`${button} bg-brand-600 text-white`}>
      {label}
    </Link>
  );
  const safe = (
    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">
      ✓ Nothing is lost — your surprise is saved as a draft, exactly as you left it.
    </p>
  );

  return (
    <Card className="space-y-4" data-testid="checkout-return" data-state={state}>
      {state === 'checking' || state === 'publishing' ? (
        <div className="flex items-center gap-3 py-4" role="status">
          <Spinner />
          <p>
            {state === 'checking'
              ? 'Checking your payment with the payment provider…'
              : 'Publishing your surprise…'}
          </p>
        </div>
      ) : state === 'live' ? (
        <div className="flex items-center gap-3 py-4" role="status">
          <Spinner />
          <p>Payment received — opening your links…</p>
        </div>
      ) : state === 'paid' ? (
        <>
          <Alert tone="success">Payment received — your surprise is unlocked.</Alert>
          {message ? <Alert tone="warning">{message}</Alert> : null}
          <p className="text-sm text-ink-600">One tap and it goes live.</p>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={publishNow}
            data-testid="publish-now"
          >
            Publish now
          </Button>
          {back('Review it first')}
        </>
      ) : state === 'declined' ? (
        <>
          <Alert tone="warning">
            This payment did not go through, so nothing was charged. You can try again with another
            card or payment method.
          </Alert>
          {safe}
          {back('Try again')}
        </>
      ) : state === 'pending' ? (
        <>
          <Alert tone="info">
            Your payment has not been confirmed yet. If you paid, your surprise goes live by itself
            within a few minutes — you do not need to pay again.
          </Alert>
          {safe}
          {back()}
        </>
      ) : state === 'failed' ? (
        <>
          <Alert tone="warning">
            This payment did not go through. If money left your account, it will be refunded
            automatically by your bank or the provider.
          </Alert>
          {safe}
          {back()}
        </>
      ) : (
        <>
          <Alert tone="danger">
            {message ?? 'We could not check this payment.'} If you paid, your surprise goes live by
            itself within a few minutes.
          </Alert>
          {safe}
          {back()}
        </>
      )}
    </Card>
  );
}
