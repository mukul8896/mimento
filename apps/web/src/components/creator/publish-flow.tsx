'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Button, Dialog, Spinner } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import {
  browserSignals,
  formatPrice,
  looksIndian,
  PAYMENT_METHODS,
  suggestedProvider,
  TIER_NAME,
  TIER_PITCH,
  type Provider,
} from '@/lib/payments';
import { formatOpensAt, type Access } from './access-panel';

interface Issue {
  stepKey: string | null;
  field: string | null;
  message: string;
}
type Options = Schemas['CheckoutOptionsResponseDto_Output'];
type Phase = 'checking' | 'issues' | 'ready' | 'pay' | 'unavailable' | 'working' | 'error';

const WHAT_YOU_GET = {
  PLUS: [
    'This surprise, exactly as you see it in the preview',
    'A private link, plus an optional PIN, opening time and short link',
    'See when it is opened and how they answered',
  ],
  PRO: [
    'Your own experience: any steps, any order, any flow',
    'A private link, plus an optional PIN, opening time and short link',
    'See when it is opened and how they answered',
  ],
} as const;

/**
 * Publish → Payment → Published, in one sheet. The draft is saved and checked first; if the
 * surprise needs PLUS or PRO, the creator sees the price and pays on the provider's page, and
 * the API publishes it as soon as the payment is confirmed. Nothing is lost if they stop at any
 * point: the draft stays exactly as it is.
 */
export function PublishFlow({
  experienceId,
  open,
  onOpenChange,
  flush,
  stepCount,
  access,
  onFixStep,
  onEditDelivery,
  stepLabel,
  onPublished,
}: {
  experienceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flush: () => Promise<boolean>;
  stepCount: number;
  access: Access | null;
  onFixStep: (stepKey: string) => void;
  onEditDelivery?: () => void;
  stepLabel: (stepKey: string) => string;
  onPublished?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);

  const problemText = (err: unknown) =>
    err instanceof ApiError
      ? (err.problem.detail ?? err.problem.title)
      : err instanceof Error
        ? err.message
        : 'Something went wrong.';

  // Runs once the draft is saved (`saved` says whether that worked).
  const check = useCallback(
    async (saved: boolean) => {
      const api = browserApi();
      const path = { id: experienceId };
      try {
        if (!saved) throw new Error('Your latest changes could not be saved yet.');
        const result = unwrap(
          await api.POST('/api/v1/experiences/{id}/publish-check', { params: { path } }),
        );
        const content = result.issues.filter((i) => i.field !== 'tier');
        if (content.length > 0) {
          setIssues(content);
          setPhase('issues');
          return;
        }
        if (result.ok) {
          setPhase('ready');
          return;
        }
        const opts = unwrap(
          await api.GET('/api/v1/experiences/{id}/checkout', { params: { path } }),
        );
        setOptions(opts);
        setProvider(suggestedProvider(opts.offers, looksIndian(browserSignals())));
        setPhase(opts.offers.length > 0 ? 'pay' : 'unavailable');
      } catch (err) {
        setError(problemText(err));
        setPhase('error');
      }
    },
    [experienceId],
  );

  useEffect(() => {
    if (!open) return;
    let current = true;
    void flush().then((saved) => {
      if (current) void check(saved);
    });
    return () => {
      current = false;
    };
  }, [open, flush, check]);

  async function publishNow() {
    setPhase('working');
    try {
      unwrap(
        await browserApi().POST('/api/v1/experiences/{id}/publish', {
          params: {
            path: { id: experienceId },
            header: { 'Idempotency-Key': crypto.randomUUID() },
          },
        }),
      );
      onPublished?.();
      // The links (recipient + private management) get a page of their own.
      router.push(`/experiences/${experienceId}/published`);
    } catch (err) {
      if (err instanceof ApiError && err.problem.issues?.length) {
        setIssues(err.problem.issues);
        setPhase('issues');
        return;
      }
      setError(problemText(err));
      setPhase('error');
    }
  }

  const offer = options?.offers.find((o) => o.provider === provider) ?? null;
  const other = options?.offers.find((o) => o.provider !== provider) ?? null;
  const tier = options?.tier.required === 'PRO' ? 'PRO' : 'PLUS';

  async function payAndPublish() {
    if (!offer) return;
    setPhase('working');
    try {
      const res = unwrap(
        await browserApi().POST('/api/v1/experiences/{id}/checkout', {
          params: { path: { id: experienceId } },
          body: { provider: offer.provider, publish: true },
        }),
      );
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setError(problemText(err));
      setPhase('pay');
    }
  }

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o)
      setTimeout(() => {
        setPhase('checking');
        setError(null);
      }, 200);
  };

  const summary = (
    <ul className="space-y-2 rounded-2xl bg-ink-50 p-3 text-sm" data-testid="publish-summary">
      <li className="flex gap-2">
        <span aria-hidden="true">✨</span>
        <span>
          {stepCount} {stepCount === 1 ? 'step' : 'steps'}, exactly as in the preview
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden="true">⏰</span>
        <span>
          {access?.opensAt ? `Opens ${formatOpensAt(access.opensAt)}` : 'Opens right away'}
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden="true">🔒</span>
        <span>
          {access?.hasPin ? 'Protected with a PIN' : 'No PIN — anyone with the link can open it'}
        </span>
      </li>
      {onEditDelivery ? (
        <li>
          <button
            type="button"
            className="min-h-9 font-medium text-brand-700 underline"
            onClick={() => {
              close(false);
              onEditDelivery();
            }}
          >
            Change delivery & privacy
          </button>
        </li>
      ) : null}
    </ul>
  );

  const title = {
    checking: 'Getting it ready…',
    issues: 'Almost there',
    ready: 'Ready to go live?',
    pay: `Publish with ${TIER_NAME[tier]}`,
    unavailable: 'Payments are resting',
    working: 'One moment…',
    error: 'That didn’t work',
  }[phase];

  const description = {
    checking: 'Saving your changes and checking everything.',
    issues: 'Finish these and you can publish.',
    ready:
      'They will see exactly this version. Later changes stay private until you publish again.',
    pay: 'You have seen everything — this is exactly what they will get.',
    unavailable: 'Everything you made is saved.',
    working: 'Please keep this page open.',
    error: 'Nothing was lost — your surprise is saved.',
  }[phase];

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        phase === 'ready' ? (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Not yet
            </Button>
            <Button size="lg" onClick={publishNow} data-testid="confirm-publish">
              Publish now
            </Button>
          </>
        ) : phase === 'pay' && offer ? (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Keep editing
            </Button>
            <Button size="lg" onClick={payAndPublish} data-testid="pay-and-publish">
              Pay {formatPrice(offer.amountMinor, offer.currency)} & publish
            </Button>
          </>
        ) : phase === 'error' ? (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setPhase('checking');
                setError(null);
                void flush().then(check);
              }}
            >
              Try again
            </Button>
          </>
        ) : phase === 'issues' || phase === 'unavailable' ? (
          <Button onClick={() => close(false)}>Back to my surprise</Button>
        ) : null
      }
    >
      <div data-testid="publish-flow" data-phase={phase}>
        {phase === 'checking' || phase === 'working' ? (
          <div className="flex items-center justify-center gap-3 py-6" role="status">
            <Spinner />
            <span className="text-sm text-ink-600">
              {phase === 'checking' ? 'Checking…' : 'Working on it…'}
            </span>
          </div>
        ) : null}

        {phase === 'issues' ? (
          <ul className="space-y-2" data-testid="publish-issues">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.stepKey ? (
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-amber-50 p-3 text-left text-sm ring-1 ring-amber-200"
                    onClick={() => {
                      close(false);
                      onFixStep(issue.stepKey!);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{stepLabel(issue.stepKey)}</span>
                      <span className="block text-amber-950">{issue.message}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-brand-700">Fix ›</span>
                  </button>
                ) : (
                  <p className="rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
                    {issue.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {phase === 'ready' ? summary : null}

        {phase === 'pay' && offer ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-brand-100">
              <p className="text-xs font-bold tracking-widest text-brand-700">{TIER_NAME[tier]}</p>
              <p className="mt-1 text-3xl font-bold" data-testid="publish-price">
                {formatPrice(offer.amountMinor, offer.currency)}
                <span className="ml-2 text-sm font-normal text-ink-500">
                  once, for this surprise
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-700">{TIER_PITCH[tier]}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {WHAT_YOU_GET[tier].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-emerald-600">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            {summary}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <p className="text-xs text-ink-600">
              Pay with {PAYMENT_METHODS[offer.provider]} on{' '}
              {offer.provider === 'RAZORPAY' ? 'Razorpay' : 'Dodo Payments'}&apos;s secure page,
              then come straight back — it goes live as soon as the payment is confirmed. If you
              cancel or the payment fails, nothing is lost: your surprise stays saved.{' '}
              <Link href="/refunds" className="underline">
                Refunds
              </Link>
            </p>
            {other ? (
              <button
                type="button"
                className="min-h-9 text-sm font-medium text-brand-700 underline"
                onClick={() => setProvider(other.provider)}
              >
                {other.provider === 'DODO'
                  ? 'Paying from outside India? Pay in US dollars'
                  : 'Paying from India? Use UPI and pay in rupees'}
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'unavailable' ? (
          <Alert tone="info">
            Payments are not available right now, so this surprise cannot go live yet. Everything
            you made is saved — try again a little later.
          </Alert>
        ) : null}

        {phase === 'error' && error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
