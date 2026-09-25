'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Spinner } from '@momentpath/design-system';
import { ParticleLayer } from '@/components/player/fx/particles';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { PRIVATE_LINK_WARNING, PrivateLinkActions, type SurpriseLinks } from './private-link';
import { WhatsAppShare } from './whatsapp-share';

const CONFETTI = ['🎉', '🎁', '✨', '💖', '🎊', '🌟'];

/**
 * After Publish (and payment): the two links the creator needs and nothing else. The recipient
 * link is for sharing; the private management link is how they come back, because there is no
 * account — so saving it is made easy and gently asked for before they leave.
 */
export function PublishedSuccess({
  experienceId,
  title,
  createdAt,
  publishedAt,
  hasPin,
  shortPath,
}: {
  experienceId: string;
  title: string;
  createdAt: string;
  publishedAt: string | null;
  hasPin: boolean;
  shortPath: string | null;
}) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [links, setLinks] = useState<SurpriseLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'recipient' | 'private' | null>(null);
  const [saved, setSaved] = useState(false);
  const [nudged, setNudged] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const confirm = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const api = browserApi();
        const path = { params: { path: { id: experienceId } } };
        const [share, manage] = await Promise.all([
          api.GET('/api/v1/experiences/{id}/share-link', path),
          api.GET('/api/v1/experiences/{id}/manage-link', path),
        ]);
        if (cancelled) return;
        const origin = window.location.origin;
        setLinks({
          title,
          createdAt,
          publishedAt,
          recipientUrl: `${origin}/e/${unwrap(share).shareToken}`,
          manageUrl: `${origin}/m/${unwrap(manage).manageToken}`,
        });
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? (err.problem.detail ?? err.problem.title)
              : 'The links could not be loaded. Refresh to try again.',
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [experienceId, title, createdAt, publishedAt]);

  // One celebratory shower when the page opens.
  useEffect(() => {
    if (reduced || !canvas.current) return;
    const layer = new ParticleLayer(canvas.current);
    const timer = setTimeout(() => layer.shower(CONFETTI), 250);
    return () => {
      clearTimeout(timer);
      layer.dispose();
    };
  }, [reduced]);

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, type: 'spring' as const, stiffness: 220, damping: 24 },
        };

  async function copy(which: 'recipient' | 'private', value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    if (which === 'private') setSaved(true);
  }

  function done() {
    // Educate, don't block: the first tap without saving is a reminder, the second goes on.
    if (!saved && !nudged) {
      setNudged(true);
      confirm.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    router.push(`/experiences/${experienceId}`);
  }

  return (
    <main
      className="relative mx-auto max-w-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10"
      data-testid="published-success"
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 size-full"
      />
      <div className="text-center">
        <motion.p
          aria-hidden="true"
          className="text-6xl"
          {...(reduced
            ? {}
            : {
                initial: { scale: 0, rotate: -20 },
                animate: { scale: 1, rotate: 0 },
                transition: { type: 'spring', stiffness: 260, damping: 12 },
              })}
        >
          🎉
        </motion.p>
        <motion.h1 className="mt-3 text-3xl font-extrabold tracking-tight" {...rise(0.05)}>
          Your Surprise Is Ready!
        </motion.h1>
        <motion.p className="mt-2 text-ink-600" {...rise(0.1)}>
          Your experience has been published successfully.
        </motion.p>
      </div>

      {error ? (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      ) : null}
      {!links && !error ? (
        <div className="mt-10 flex justify-center" role="status">
          <Spinner />
        </div>
      ) : null}

      {links ? (
        <div className="mt-8 space-y-5">
          <motion.section
            {...rise(0.18)}
            aria-labelledby="recipient-heading"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink-100"
          >
            <h2 id="recipient-heading" className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">💌</span> Recipient Link
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              Send this link to the person receiving your surprise.
            </p>
            <Input
              readOnly
              className="mt-3"
              value={links.recipientUrl}
              aria-label="Recipient link"
              data-testid="recipient-link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button onClick={() => copy('recipient', links.recipientUrl)}>
                {copied === 'recipient' ? '✅ Copied!' : 'Copy Recipient Link'}
              </Button>
              <WhatsAppShare
                link={shortPath ? `${window.location.origin}${shortPath}` : links.recipientUrl}
              />
            </div>
            {shortPath ? (
              <p className="mt-3 text-sm text-ink-600">
                Short link: <span className="font-medium">{shortPath}</span>
              </p>
            ) : null}
            {hasPin ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                🔒 Send the PIN separately from the link.
              </p>
            ) : null}
          </motion.section>

          <motion.section
            {...rise(0.3)}
            aria-labelledby="private-heading"
            className="rounded-3xl bg-ink-900 p-5 text-white shadow-lg"
          >
            <h2 id="private-heading" className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">🔑</span> Your Private Management Link
            </h2>
            <p className="mt-1 text-sm text-ink-200">
              Use this link to manage this surprise and view results and activity.
            </p>
            <Input
              readOnly
              className="mt-3"
              value={links.manageUrl}
              aria-label="Private management link"
              data-testid="private-link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => copy('private', links.manageUrl)}
            >
              {copied === 'private' ? '✅ Copied!' : 'Copy Private Link'}
            </Button>
            <div className="mt-2 [&_button]:bg-white/10 [&_button]:text-white [&_button]:ring-white/20 [&_button:hover]:bg-white/20">
              <PrivateLinkActions links={links} withCopy={false} onSaved={() => setSaved(true)} />
            </div>
            <div
              className="mt-4 rounded-2xl bg-amber-300/15 p-3 text-sm ring-1 ring-amber-200/30"
              data-testid="private-link-warning"
            >
              <p className="font-semibold text-amber-100">Important</p>
              <p className="mt-1 text-amber-50">{PRIVATE_LINK_WARNING}</p>
              <p className="mt-2 text-amber-50/80">
                Anyone with this private link may be able to manage your experience. Keep it
                private.
              </p>
            </div>
          </motion.section>

          <motion.div {...rise(0.42)} className="space-y-3">
            <motion.label
              ref={confirm}
              animate={nudged && !saved && !reduced ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ${
                nudged && !saved ? 'ring-2 ring-amber-400' : 'ring-ink-100'
              }`}
            >
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="size-6 shrink-0 accent-brand-600"
                data-testid="saved-confirm"
              />
              <span className="text-sm font-medium">I’ve saved my private management link</span>
            </motion.label>
            {nudged && !saved ? (
              <p role="status" className="text-center text-sm text-amber-900">
                Copy, bookmark or download it first — it is the only way back to this surprise. Tap
                Done again to continue anyway.
              </p>
            ) : null}
            <Button size="lg" className="w-full" onClick={done} data-testid="success-done">
              Done — manage my surprise
            </Button>
          </motion.div>
        </div>
      ) : null}
    </main>
  );
}
