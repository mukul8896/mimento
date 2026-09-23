import { describe, expect, it } from 'vitest';
import {
  effectiveStatus,
  isPubliclyAvailable,
  transition,
  type LifecycleSubject,
} from './lifecycle';

const now = new Date('2026-09-22T12:00:00Z');
const past = new Date('2026-09-21T12:00:00Z');
const future = new Date('2026-09-23T12:00:00Z');
const exp = (over: Partial<LifecycleSubject> = {}): LifecycleSubject => ({
  status: 'PUBLISHED',
  moderationState: 'ACTIVE',
  expiresAt: null,
  activeVersionId: 'v1',
  ...over,
});

describe('effectiveStatus / availability', () => {
  it('treats a published experience past its expiry as EXPIRED', () => {
    expect(effectiveStatus(exp({ expiresAt: past }), now)).toBe('EXPIRED');
    expect(effectiveStatus(exp({ expiresAt: future }), now)).toBe('PUBLISHED');
  });

  it.each([
    [exp(), true],
    [exp({ status: 'DRAFT', activeVersionId: null }), false],
    [exp({ status: 'DISABLED' }), false],
    [exp({ status: 'EXPIRED' }), false],
    [exp({ status: 'DELETED' }), false],
    [exp({ expiresAt: past }), false],
    [exp({ expiresAt: now }), false],
    [exp({ moderationState: 'TAKEN_DOWN' }), false],
    [exp({ activeVersionId: null }), false],
  ])('%j available=%s', (subject, available) => {
    expect(isPubliclyAvailable(subject, now)).toBe(available);
  });
});

describe('transition', () => {
  it.each([
    ['DRAFT', 'publish', 'PUBLISHED'],
    ['PUBLISHED', 'publish', 'PUBLISHED'],
    ['PUBLISHED', 'disable', 'DISABLED'],
    ['DISABLED', 'enable', 'PUBLISHED'],
    ['PUBLISHED', 'expire', 'EXPIRED'],
    ['DISABLED', 'expire', 'EXPIRED'],
    ['EXPIRED', 'setExpiry', 'PUBLISHED'],
    ['DRAFT', 'delete', 'DELETED'],
    ['PUBLISHED', 'delete', 'DELETED'],
  ] as const)('%s --%s--> %s', (from, action, to) => {
    const result = transition(
      exp({ status: from }),
      action,
      now,
      action === 'setExpiry' ? future : undefined,
    );
    expect(result).toEqual({ ok: true, status: to });
  });

  it.each([
    ['DRAFT', 'disable'],
    ['DRAFT', 'enable'],
    ['DRAFT', 'expire'],
    ['PUBLISHED', 'enable'],
    ['DISABLED', 'publish'],
    ['EXPIRED', 'publish'],
    ['EXPIRED', 'disable'],
    ['DELETED', 'publish'],
    ['DELETED', 'delete'],
  ] as const)('refuses %s --%s-->', (from, action) => {
    expect(transition(exp({ status: from }), action, now).ok).toBe(false);
  });

  it('refuses past expiry dates and re-enabling past expiry', () => {
    expect(transition(exp(), 'setExpiry', now, past)).toMatchObject({
      ok: false,
      code: 'INVALID_EXPIRY',
    });
    expect(transition(exp({ status: 'DISABLED', expiresAt: past }), 'enable', now)).toMatchObject({
      ok: false,
      code: 'EXPIRED',
    });
  });

  it('blocks owner publish/enable of taken-down content but still allows deletion', () => {
    const takenDown = exp({ moderationState: 'TAKEN_DOWN' });
    expect(transition(takenDown, 'publish', now)).toMatchObject({ ok: false, code: 'TAKEN_DOWN' });
    expect(transition({ ...takenDown, status: 'DISABLED' }, 'enable', now)).toMatchObject({
      ok: false,
      code: 'TAKEN_DOWN',
    });
    expect(transition(takenDown, 'delete', now).ok).toBe(true);
  });
});
