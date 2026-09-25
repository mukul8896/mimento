'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Badge, Button, Card, Dialog, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { formatDate, formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { AccessPanel } from './access-panel';
import { PRIVATE_LINK_WARNING, PrivateLinkActions, type SurpriseLinks } from './private-link';
import { WhatsAppShare } from './whatsapp-share';
import { UnlockPanel } from './unlock-panel';

type Detail = Schemas['ExperienceDetailDto_Output'];

function idempotencyKey() {
  return crypto.randomUUID();
}

export function ManageExperience({ experience }: { experience: Detail }) {
  const router = useRouter();
  const api = browserApi();
  const id = experience.id;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [privateLinks, setPrivateLinks] = useState<SurpriseLinks | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'disable' | 'expire' | 'delete' | 'rotate' | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [expiry, setExpiry] = useState(
    experience.expiresAt ? experience.expiresAt.slice(0, 16) : '',
  );

  const everPublished = experience.publishedVersion !== null;
  const takenDown = experience.moderationState === 'TAKEN_DOWN';

  async function run(name: string, action: () => Promise<unknown>, after?: () => void) {
    setBusy(name);
    setError(null);
    try {
      await action();
      after?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : 'Something went wrong.',
      );
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  async function showLink() {
    await run('link', async () => {
      const res = unwrap(
        await api.GET('/api/v1/experiences/{id}/share-link', { params: { path: { id } } }),
      );
      setLink(`${window.location.origin}/e/${res.shareToken}`);
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** The private management link, shown only on request so it is not on screen by default. */
  async function showManageLink() {
    await run('manage', async () => {
      const path = { params: { path: { id } } };
      const [manage, share] = await Promise.all([
        api.GET('/api/v1/experiences/{id}/manage-link', path),
        api.GET('/api/v1/experiences/{id}/share-link', path),
      ]);
      const origin = window.location.origin;
      setPrivateLinks({
        title: experience.title,
        createdAt: experience.createdAt,
        publishedAt: experience.publishedAt,
        recipientUrl: `${origin}/e/${unwrap(share).shareToken}`,
        manageUrl: `${origin}/m/${unwrap(manage).manageToken}`,
      });
    });
  }

  const lifecycle = (path: '/disable' | '/enable' | '/expire') => () =>
    run(path, async () =>
      unwrap(
        await api.POST(`/api/v1/experiences/{id}${path}`, {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey() } },
        }),
      ),
    );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
            Manage Surprise
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold">
            {experience.title || 'Untitled'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[experience.status]}>{STATUS_LABEL[experience.status]}</Badge>
            {experience.publishedVersion ? (
              <span className="text-xs text-ink-500">Version {experience.publishedVersion}</span>
            ) : null}
            {experience.hasUnpublishedChanges && everPublished ? (
              <Badge tone="info">Unpublished changes</Badge>
            ) : null}
          </div>
        </div>
        <Link
          href={`/experiences/${id}/${experience.mode === 'TEMPLATE' ? 'personalize' : 'edit'}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white sm:w-auto"
        >
          {experience.mode === 'TEMPLATE' ? 'Personalize' : 'Edit'}
        </Link>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {takenDown ? (
        <Alert tone="danger">
          This experience was disabled by our moderation team
          {experience.takedownReason ? `: ${experience.takedownReason}` : ''}. It cannot be viewed
          until it is reviewed again.
        </Alert>
      ) : null}

      {!experience.tier.satisfied ? (
        <Alert tone="info">
          <strong className="font-semibold">
            {experience.tier.required === 'PRO'
              ? 'This is a PRO experience'
              : 'This template is part of PLUS'}
          </strong>
          <p className="mt-1 text-sm">
            {experience.tier.required === 'PRO'
              ? 'You are building your own experience. Publish with PRO to share it — everything you have made is saved either way.'
              : 'Publish with PLUS to share it. Everything you have personalised is saved either way.'}
          </p>
        </Alert>
      ) : null}
      {!experience.tier.satisfied ? <UnlockPanel experienceId={id} /> : null}

      {!everPublished ? (
        <Card className="bg-gradient-to-br from-brand-50 to-white" data-testid="unpublished-card">
          <h2 className="font-semibold">Not published yet</h2>
          <p className="mt-1 text-sm text-ink-600">
            This surprise is unfinished and only on this device. It is kept for 30 days after you
            last open it. Publish it to get your recipient link and your private management link.
          </p>
          <Link
            href={`/experiences/${id}/${experience.mode === 'TEMPLATE' ? 'personalize' : 'edit'}`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white sm:w-auto"
          >
            Continue and publish
          </Link>
        </Card>
      ) : (
        <section
          className="rounded-2xl bg-ink-900 p-4 text-white shadow-sm sm:p-6"
          data-testid="private-link-card"
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <span aria-hidden="true">🔑</span> Your Private Management Link
          </h2>
          <p className="mt-1 text-sm text-ink-200">
            Anyone with this private link may be able to manage your experience. Keep it private —
            it is not the link you send.
          </p>
          <div className="mt-3 space-y-3">
            {privateLinks ? (
              <>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={privateLinks.manageUrl}
                    aria-label="Private management link"
                    data-testid="private-link"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="[&_button]:bg-white/10 [&_button]:text-white [&_button]:ring-white/20">
                  <PrivateLinkActions links={privateLinks} />
                </div>
              </>
            ) : (
              <Button
                variant="secondary"
                busy={busy === 'manage'}
                onClick={showManageLink}
                data-testid="show-private-link"
              >
                Show private link
              </Button>
            )}
            <p className="rounded-xl bg-amber-300/15 p-3 text-sm text-amber-50 ring-1 ring-amber-200/30">
              {PRIVATE_LINK_WARNING}
            </p>
          </div>
        </section>
      )}

      <Card>
        <h2 className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true">💌</span> Recipient Link
        </h2>
        {!everPublished ? (
          <p className="mt-2 text-sm text-ink-600">You get it when you publish.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {link ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={link}
                  aria-label="Recipient link"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button onClick={copy} variant="secondary" className="shrink-0">
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
                <WhatsAppShare link={link} />
              </div>
            ) : (
              <Button onClick={showLink} busy={busy === 'link'} variant="secondary">
                Show recipient link
              </Button>
            )}
            <p className="text-xs text-ink-500">
              Anyone with this link can open the experience. Recipients can forward links and take
              screenshots — share it only with the person it is for. The link is hidden from search
              engines.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setConfirm('rotate')}>
              Replace link
            </Button>
          </div>
        )}
      </Card>

      <AccessPanel experienceId={id} initial={experience.access} />

      <Card>
        <h2 className="font-semibold">Availability</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-ink-500">Published</dt>
            <dd>{formatDateTime(experience.publishedAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Expires</dt>
            <dd>{experience.expiresAt ? formatDateTime(experience.expiresAt) : 'Never'}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Kept until</dt>
            <dd data-testid="kept-until">
              {experience.keptUntil ? formatDate(experience.keptUntil) : 'Always'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Opened / completed</dt>
            <dd>
              {experience.stats.started} / {experience.stats.completed}
            </dd>
          </div>
        </dl>
        {experience.keptUntil ? (
          <p className="mt-3 text-xs text-ink-500">
            {everPublished
              ? 'Surprises nobody has used for a year are deleted. Each time you open your private link, or they open theirs, it is kept for another year.'
              : 'Unfinished surprises are deleted 30 days after they were last opened.'}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {experience.status === 'PUBLISHED' ? (
            <Button variant="secondary" onClick={() => setConfirm('disable')}>
              Disable link
            </Button>
          ) : null}
          {experience.status === 'DISABLED' ? (
            <Button
              variant="secondary"
              onClick={lifecycle('/enable')}
              busy={busy === '/enable'}
              disabled={takenDown}
            >
              Re-enable link
            </Button>
          ) : null}
          {experience.status === 'PUBLISHED' || experience.status === 'DISABLED' ? (
            <Button variant="secondary" onClick={() => setConfirm('expire')}>
              Expire now
            </Button>
          ) : null}
        </div>
        {everPublished ? (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run('expiry', async () =>
                unwrap(
                  await api.PUT('/api/v1/experiences/{id}/expiry', {
                    params: { path: { id } },
                    body: { expiresAt: expiry ? new Date(expiry).toISOString() : null },
                  }),
                ),
              );
            }}
          >
            <Field
              label="Automatic expiry"
              hint="Leave empty to keep the link open. Expired links show a neutral page."
              className="flex-1"
            >
              {(p) => (
                <Input
                  type="datetime-local"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  {...p}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" busy={busy === 'expiry'}>
              Save expiry
            </Button>
          </form>
        ) : null}
      </Card>

      <Card className="ring-red-100">
        <h2 className="font-semibold text-red-800">Delete permanently</h2>
        <p className="mt-1 text-sm text-ink-600">
          Removes the experience, all recipient answers and uploaded images. The link stops working
          immediately. This cannot be undone.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirm('delete')}>
          Delete experience
        </Button>
      </Card>

      <Dialog
        open={confirm === 'disable'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Disable this link?"
        description="Recipients will see a neutral “not available” page until you re-enable it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={lifecycle('/disable')} busy={busy === '/disable'}>
              Disable
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === 'expire'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Expire now?"
        description="The link stops working now. You can reopen it later by setting a new expiry date."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={lifecycle('/expire')} busy={busy === '/expire'}>
              Expire
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === 'rotate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Replace the private link?"
        description="The current link stops working and anyone who has it loses access. You will need to share the new link."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              busy={busy === 'rotate'}
              onClick={() =>
                run('rotate', async () => {
                  const res = unwrap(
                    await api.POST('/api/v1/experiences/{id}/share-link/rotate', {
                      params: { path: { id } },
                    }),
                  );
                  setLink(`${window.location.origin}/e/${res.shareToken}`);
                })
              }
            >
              Replace link
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === 'delete'}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            setDeleteText('');
          }
        }}
        title="Delete permanently?"
        description="Type DELETE to confirm. All answers and images are removed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteText !== 'DELETE'}
              busy={busy === 'delete'}
              onClick={() =>
                run(
                  'delete',
                  async () =>
                    unwrap(
                      await api.DELETE('/api/v1/experiences/{id}', {
                        params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey() } },
                      }),
                    ),
                  () => router.push('/'),
                )
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <Field label="Confirmation">
          {(p) => (
            <Input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              autoComplete="off"
              {...p}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
