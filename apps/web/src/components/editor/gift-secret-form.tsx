'use client';

import { useEffect, useState } from 'react';
import { GiftSecretSchema, type GiftKind, type GiftSecret } from '@momentpath/contracts';
import { Alert, Button, Field, Input, Textarea } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { MediaUpload } from './media-upload';
import type { StepFormContext } from './step-forms';

type Values = Record<string, string>;

function toSecret(kind: GiftKind, v: Values): unknown {
  switch (kind) {
    case 'VOUCHER_CODE':
      return {
        kind,
        code: v.code ?? '',
        pin: v.pin ?? '',
        redeemUrl: v.redeemUrl ?? '',
        instructions: v.instructions ?? '',
      };
    case 'URL':
      return { kind, url: v.url ?? '', instructions: v.instructions ?? '' };
    case 'QR_IMAGE':
      return { kind, mediaId: v.mediaId ?? '', instructions: v.instructions ?? '' };
    case 'INSTRUCTION':
      return { kind, instructions: v.instructions ?? '' };
    case 'PHYSICAL_MESSAGE':
      return { kind, message: v.message ?? '' };
  }
}

function fromSecret(secret: GiftSecret | null): Values {
  if (!secret) return {};
  const { kind: _kind, ...rest } = secret;
  return rest as Values;
}

/**
 * Private surprise details. Loaded and saved through owner-only endpoints, encrypted at rest,
 * and never included in the draft, the preview or the recipient page until eligible.
 */
export function GiftSecretForm({
  stepKey,
  kind,
  ctx,
}: {
  stepKey: string;
  kind: GiftKind;
  ctx: StepFormContext;
}) {
  const [values, setValues] = useState<Values>({});
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const hadSecret = ctx.hasGiftSecret(stepKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hadSecret) {
        setState('idle');
        return;
      }
      try {
        const res = unwrap(
          await browserApi().GET('/api/v1/experiences/{experienceId}/draft/gifts/{stepKey}', {
            params: { path: { experienceId: ctx.experienceId, stepKey } },
          }),
        );
        if (!cancelled) {
          setValues(
            res.secret && res.secret.kind === kind ? fromSecret(res.secret as GiftSecret) : {},
          );
          setState('idle');
        }
      } catch {
        if (!cancelled) setState('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once per step/kind; the parent remounts this form when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  async function save() {
    setError(null);
    const parsed = GiftSecretSchema.safeParse(toSecret(kind, values));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the surprise details.');
      return;
    }
    setState('saving');
    if (!(await ctx.flush())) {
      setState('error');
      setError('Save the draft first, then try again.');
      return;
    }
    try {
      unwrap(
        await browserApi().PUT('/api/v1/experiences/{experienceId}/draft/gifts/{stepKey}', {
          params: { path: { experienceId: ctx.experienceId, stepKey } },
          body: { secret: parsed.data },
        }),
      );
      ctx.setGiftSecretSaved(stepKey, true);
      setState('saved');
    } catch (err) {
      setState('error');
      setError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : 'Could not save the surprise details.',
      );
    }
  }

  return (
    <section
      aria-labelledby={`secret-${stepKey}`}
      className="space-y-4 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-100"
    >
      <div>
        <h3 id={`secret-${stepKey}`} className="font-semibold">
          Surprise details (private)
        </h3>
        <p className="text-xs text-ink-600">
          Encrypted and only shown to the recipient after they finish every earlier step. Wish
          Revealer does not sell or check vouchers — use one you obtained elsewhere.
        </p>
      </div>
      {state === 'loading' ? <p className="text-sm text-ink-500">Loading…</p> : null}
      {kind === 'VOUCHER_CODE' ? (
        <>
          <Field label="Voucher code">
            {(p) => (
              <Input
                value={values.code ?? ''}
                maxLength={200}
                onChange={set('code')}
                autoComplete="off"
                {...p}
              />
            )}
          </Field>
          <Field label="PIN (optional)">
            {(p) => (
              <Input
                value={values.pin ?? ''}
                maxLength={50}
                onChange={set('pin')}
                autoComplete="off"
                {...p}
              />
            )}
          </Field>
          <Field label="Where to redeem (optional https link)">
            {(p) => (
              <Input type="url" value={values.redeemUrl ?? ''} onChange={set('redeemUrl')} {...p} />
            )}
          </Field>
          <Field label="Instructions (optional)">
            {(p) => (
              <Textarea
                value={values.instructions ?? ''}
                maxLength={2000}
                onChange={set('instructions')}
                {...p}
              />
            )}
          </Field>
        </>
      ) : null}
      {kind === 'URL' ? (
        <>
          <Field label="Gift link (https)">
            {(p) => <Input type="url" value={values.url ?? ''} onChange={set('url')} {...p} />}
          </Field>
          <Field label="Instructions (optional)">
            {(p) => (
              <Textarea
                value={values.instructions ?? ''}
                maxLength={2000}
                onChange={set('instructions')}
                {...p}
              />
            )}
          </Field>
        </>
      ) : null}
      {kind === 'QR_IMAGE' ? (
        <>
          <MediaUpload
            label="QR code image"
            experienceId={ctx.experienceId}
            value={values.mediaId ?? null}
            media={ctx.media}
            onUploaded={(item) => {
              ctx.addMedia(item);
              setValues((v) => ({ ...v, mediaId: item.id }));
            }}
            onClear={() => setValues((v) => ({ ...v, mediaId: '' }))}
          />
          <Field label="Instructions (optional)">
            {(p) => (
              <Textarea
                value={values.instructions ?? ''}
                maxLength={2000}
                onChange={set('instructions')}
                {...p}
              />
            )}
          </Field>
        </>
      ) : null}
      {kind === 'INSTRUCTION' ? (
        <Field label="Instructions">
          {(p) => (
            <Textarea
              value={values.instructions ?? ''}
              maxLength={2000}
              onChange={set('instructions')}
              {...p}
            />
          )}
        </Field>
      ) : null}
      {kind === 'PHYSICAL_MESSAGE' ? (
        <Field label="Message revealed at the end">
          {(p) => (
            <Textarea
              value={values.message ?? ''}
              maxLength={2000}
              onChange={set('message')}
              {...p}
            />
          )}
        </Field>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex items-center gap-3">
        <Button onClick={save} busy={state === 'saving'}>
          Save surprise details
        </Button>
        <span role="status" className="text-sm text-ink-600">
          {state === 'saved' ? 'Saved' : hadSecret ? 'Details saved earlier' : 'Not saved yet'}
        </span>
      </div>
    </section>
  );
}
