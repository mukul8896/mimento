'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Badge, Button, Card, Dialog, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/lib/format';

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
  const [manageLink, setManageLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manageCopied, setManageCopied] = useState(false);
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

  async function showManageLink() {
    await run('manage', async () => {
      const res = unwrap(
        await api.GET('/api/v1/experiences/{id}/manage-link', { params: { path: { id } } }),
      );
      setManageLink(`${window.location.origin}/m/${res.manageToken}`);
    });
  }

  async function copyManageLink() {
    if (!manageLink) return;
    await navigator.clipboard.writeText(manageLink);
    setManageCopied(true);
    setTimeout(() => setManageCopied(false), 2000);
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
          <Link href="/dashboard" className="text-sm text-ink-500 hover:underline">
            ← Dashboard
          </Link>
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
          href={`/experiences/${id}/edit`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white sm:w-auto"
        >
          Edit
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
              ? 'This is a custom build'
              : 'This template is part of Plus'}
          </strong>
          <p className="mt-1 text-sm">
            {experience.tier.required === 'PRO'
              ? 'You changed which steps this surprise has, so it counts as your own sequence rather than a template. Unlock the custom plan to share it.'
              : 'Unlock it to share this surprise. Everything you have written is saved either way.'}
          </p>
        </Alert>
      ) : null}

      <Card>
        <h2 className="font-semibold">Your link back to this surprise</h2>
        <p className="mt-2 text-sm text-ink-600">
          You have no account, so this browser is what remembers this surprise. Save this link and
          you can edit it and see the replies from any device — after clearing your browser, or on
          your phone. Keep it to yourself: it is not the link you send.
        </p>
        <div className="mt-3 space-y-2">
          {manageLink ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={manageLink}
                aria-label="Your link back to this surprise"
                onFocus={(e) => e.target.select()}
              />
              <Button onClick={copyManageLink}>{manageCopied ? 'Copied' : 'Copy'}</Button>
            </div>
          ) : (
            <Button busy={busy === 'manage'} onClick={showManageLink}>
              Show my link
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Share</h2>
        {!everPublished ? (
          <p className="mt-2 text-sm text-ink-600">
            Publish your experience from the editor to get a private link.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {link ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={link}
                  aria-label="Private link"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button onClick={copy} variant="secondary" className="shrink-0">
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
              </div>
            ) : (
              <Button onClick={showLink} busy={busy === 'link'} variant="secondary">
                Show private link
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

      <Card>
        <h2 className="font-semibold">Availability</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-500">Published</dt>
            <dd>{formatDateTime(experience.publishedAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Expires</dt>
            <dd>{experience.expiresAt ? formatDateTime(experience.expiresAt) : 'Never'}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Opened / completed</dt>
            <dd>
              {experience.stats.started} / {experience.stats.completed}
            </dd>
          </div>
        </dl>
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
                  () => router.push('/dashboard'),
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
