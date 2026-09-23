import type { ExperienceStatus, ModerationState } from '../../generated/prisma/client';

export interface LifecycleSubject {
  status: ExperienceStatus;
  moderationState: ModerationState;
  expiresAt: Date | null;
  activeVersionId: string | null;
}

/** Stored status plus scheduled expiry: a published experience past its expiry is EXPIRED. */
export function effectiveStatus(
  exp: Pick<LifecycleSubject, 'status' | 'expiresAt'>,
  now: Date,
): ExperienceStatus {
  if (exp.status === 'PUBLISHED' && exp.expiresAt !== null && exp.expiresAt <= now)
    return 'EXPIRED';
  return exp.status;
}

/** Fail-closed public availability check used by every recipient endpoint. */
export function isPubliclyAvailable(exp: LifecycleSubject, now: Date): boolean {
  return (
    effectiveStatus(exp, now) === 'PUBLISHED' &&
    exp.moderationState === 'ACTIVE' &&
    exp.activeVersionId !== null
  );
}

export type LifecycleAction = 'publish' | 'disable' | 'enable' | 'expire' | 'setExpiry' | 'delete';

export type TransitionResult =
  { ok: true; status: ExperienceStatus } | { ok: false; code: string; message: string };

/**
 * Creator lifecycle state machine:
 *   DRAFT -> PUBLISHED -> DISABLED | EXPIRED | DELETED
 * DISABLED can be re-enabled, EXPIRED can be revived by setting a future expiry (or none),
 * DELETED is terminal. A taken-down experience cannot be published or re-enabled by its owner.
 */
export function transition(
  exp: LifecycleSubject,
  action: LifecycleAction,
  now: Date,
  newExpiry?: Date | null,
): TransitionResult {
  const current = effectiveStatus(exp, now);
  const fail = (code: string, message: string): TransitionResult => ({ ok: false, code, message });
  if (current === 'DELETED') return fail('DELETED', 'This experience has been deleted');
  if (action === 'delete') return { ok: true, status: 'DELETED' };

  const takenDown = exp.moderationState === 'TAKEN_DOWN';
  switch (action) {
    case 'publish':
      if (takenDown) return fail('TAKEN_DOWN', 'This experience was disabled by moderation');
      if (current === 'DRAFT' || current === 'PUBLISHED') return { ok: true, status: 'PUBLISHED' };
      return fail(
        'NOT_ACTIVE',
        'Re-enable or extend this experience before publishing a new version',
      );
    case 'disable':
      if (current === 'PUBLISHED') return { ok: true, status: 'DISABLED' };
      return fail('INVALID_TRANSITION', 'Only a live experience can be disabled');
    case 'enable':
      if (takenDown) return fail('TAKEN_DOWN', 'This experience was disabled by moderation');
      if (current !== 'DISABLED')
        return fail('INVALID_TRANSITION', 'Only a disabled experience can be re-enabled');
      if (exp.expiresAt !== null && exp.expiresAt <= now) {
        return fail('EXPIRED', 'Extend the expiry date before re-enabling');
      }
      return { ok: true, status: 'PUBLISHED' };
    case 'expire':
      if (current === 'PUBLISHED' || current === 'DISABLED') return { ok: true, status: 'EXPIRED' };
      return fail('INVALID_TRANSITION', 'Only a published experience can be expired');
    case 'setExpiry': {
      if (newExpiry && newExpiry <= now)
        return fail('INVALID_EXPIRY', 'Choose a date in the future');
      if (current === 'EXPIRED') {
        if (takenDown) return fail('TAKEN_DOWN', 'This experience was disabled by moderation');
        return { ok: true, status: 'PUBLISHED' };
      }
      // Scheduled expiry does not change the stored status of drafts or disabled experiences.
      return { ok: true, status: exp.status };
    }
  }
}
